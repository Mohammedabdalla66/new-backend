import { cloudinary } from '../config/cloudinary.js';
import axios from 'axios';
import { Readable } from 'stream';

/**
 * Extract public_id from Cloudinary URL
 * @param {string} cloudinaryUrl - Full Cloudinary URL (secure_url)
 * @returns {string|null} - Public ID or null if invalid
 */
function extractPublicId(cloudinaryUrl) {
  if (!cloudinaryUrl || typeof cloudinaryUrl !== 'string') {
    return null;
  }

  try {
    // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{version}/{public_id}.{format}
    // For raw files: https://res.cloudinary.com/{cloud_name}/raw/upload/{version}/{public_id}
    
    // Extract the path after /upload/
    const uploadMatch = cloudinaryUrl.match(/\/upload\/[^/]+\/(.+)$/);
    if (uploadMatch) {
      let publicId = uploadMatch[1];
      
      // Remove version if present at the start
      publicId = publicId.replace(/^v\d+\//, '');
      
      // Remove format extension if present (for raw files, might not have one)
      // But we'll keep it to preserve the original filename
      
      return publicId;
    }
    
    // Alternative: Extract from URL path
    const url = new URL(cloudinaryUrl);
    const pathParts = url.pathname.split('/');
    const uploadIndex = pathParts.indexOf('upload');
    
    if (uploadIndex !== -1 && pathParts.length > uploadIndex + 2) {
      // Get everything after version
      let publicId = pathParts.slice(uploadIndex + 2).join('/');
      return publicId;
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting public_id from URL:', error);
    return null;
  }
}

/**
 * Get file info from Cloudinary using public_id
 */
async function getFileInfo(publicId, resourceType = 'raw') {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    console.error('Error getting file info from Cloudinary:', error);
    throw error;
  }
}

/**
 * Download file from Cloudinary and serve it
 */
export async function downloadFile(req, res, next) {
  try {
    const { publicId, url, resourceType = 'raw' } = req.query;

    // Get public_id from query param or extract from URL
    let filePublicId = publicId;
    
    if (!filePublicId && url) {
      filePublicId = extractPublicId(url);
    }

    if (!filePublicId) {
      return res.status(400).json({
        success: false,
        message: 'Missing publicId or url parameter',
      });
    }

    console.log(`📥 Downloading file with public_id: ${filePublicId}, resource_type: ${resourceType}`);

    // Get file information from Cloudinary
    let fileInfo;
    try {
      fileInfo = await getFileInfo(filePublicId, resourceType);
    } catch (error) {
      console.error('Error fetching file info:', error);
      return res.status(404).json({
        success: false,
        message: 'File not found in Cloudinary',
        error: error.message,
      });
    }

    // Generate a signed download URL to avoid 401 errors
    // For raw files, we need to generate a signed URL that will work even if the file is private
    let downloadUrl;
    try {
      // Use Cloudinary URL helper to generate a signed URL
      // For raw files, we need to use the resource_type and generate a signed URL
      downloadUrl = cloudinary.url(filePublicId, {
        resource_type: resourceType,
        type: 'upload',
        secure: true,
        sign_url: true, // Sign the URL to avoid 401 errors
      });
      
      // If secure_url is available and file is public, we can use it
      // But for private files, use the signed URL
      if (!downloadUrl && (fileInfo.secure_url || fileInfo.url)) {
        downloadUrl = fileInfo.secure_url || fileInfo.url;
      }
    } catch (urlError) {
      console.error('Error generating signed URL:', urlError);
      // Fallback to secure_url if available
      downloadUrl = fileInfo.secure_url || fileInfo.url;
    }
    
    if (!downloadUrl) {
      return res.status(404).json({
        success: false,
        message: 'File URL not found',
      });
    }

    // Determine filename - use original filename from attachment name if available
    // Otherwise, extract from public_id or use a default
    let fileName = req.query.filename;
    
    if (!fileName) {
      // Extract from public_id (format: timestamp_originalname or folder/timestamp_originalname)
      const publicIdParts = filePublicId.split('/');
      const lastPart = publicIdParts[publicIdParts.length - 1];
      
      // Remove timestamp prefix if present (format: timestamp_filename)
      const parts = lastPart.split('_');
      if (parts.length > 1 && /^\d+$/.test(parts[0])) {
        // First part is timestamp
        fileName = parts.slice(1).join('_');
      } else {
        fileName = lastPart;
      }
      
      // Ensure file has extension
      if (!fileName.includes('.')) {
        // Try to get format from fileInfo or use original extension from attachment name
        if (fileInfo.format) {
          fileName = `${fileName}.${fileInfo.format}`;
        }
      }
    }

    // If still no filename, use a default
    if (!fileName) {
      fileName = `download_${Date.now()}`;
      if (fileInfo.format) {
        fileName = `${fileName}.${fileInfo.format}`;
      }
    }

    // Fetch the file from Cloudinary
    try {
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
      });

      // Determine content type
      let contentType = 'application/octet-stream';
      if (fileInfo.format) {
        const mimeTypes = {
          pdf: 'application/pdf',
          doc: 'application/msword',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
        };
        contentType = mimeTypes[fileInfo.format.toLowerCase()] || contentType;
      }

      // Set response headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', response.data.length);

      // Send the file
      res.send(Buffer.from(response.data));
    } catch (downloadError) {
      console.error('Error downloading file from Cloudinary:', downloadError);
      return res.status(500).json({
        success: false,
        message: 'Error downloading file from Cloudinary',
        error: downloadError.message,
      });
    }
  } catch (error) {
    console.error('Error in downloadFile controller:', error);
    next(error);
  }
}

