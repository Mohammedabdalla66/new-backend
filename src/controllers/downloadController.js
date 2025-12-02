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
    // For raw files uploaded with upload presets, we need signed URLs
    let downloadUrl;
    let fileBuffer;
    
    try {
      // First, try using secure_url directly (for public files uploaded with upload preset)
      const secureUrl = fileInfo.secure_url || fileInfo.url;
      
      if (secureUrl) {
        try {
          console.log('Attempting to download via secure_url...');
          const response = await axios.get(secureUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            validateStatus: (status) => status < 500,
          });
          
          if (response.status === 200) {
            fileBuffer = Buffer.from(response.data);
            console.log('✅ File downloaded successfully via secure_url');
          } else if (response.status === 401) {
            console.log('Secure URL returned 401, generating signed URL...');
            // If secure_url gives 401, generate a signed URL
            downloadUrl = cloudinary.url(filePublicId, {
              resource_type: resourceType,
              secure: true,
              sign_url: true,
            });
            
            const signedResponse = await axios.get(downloadUrl, {
              responseType: 'arraybuffer',
              timeout: 30000,
            });
            
            if (signedResponse.status === 200) {
              fileBuffer = Buffer.from(signedResponse.data);
              console.log('✅ File downloaded successfully via signed URL');
            } else {
              throw new Error(`Signed URL returned status ${signedResponse.status}`);
            }
          } else {
            throw new Error(`Secure URL returned status ${response.status}`);
          }
        } catch (urlError) {
          // If secure_url fetch fails, try signed URL
          if (urlError.response?.status === 401 || !fileBuffer) {
            console.log('URL fetch failed, generating signed URL as fallback...');
            downloadUrl = cloudinary.url(filePublicId, {
              resource_type: resourceType,
              secure: true,
              sign_url: true,
            });
            
            const signedResponse = await axios.get(downloadUrl, {
              responseType: 'arraybuffer',
              timeout: 30000,
            });
            
            if (signedResponse.status === 200) {
              fileBuffer = Buffer.from(signedResponse.data);
              console.log('✅ File downloaded successfully via signed URL');
            } else {
              throw urlError; // Re-throw original error
            }
          } else {
            throw urlError;
          }
        }
      } else {
        throw new Error('No secure URL available for download');
      }
    } catch (downloadError) {
      console.error('Error downloading file from Cloudinary:', downloadError);
      
      // If all methods fail, return detailed error
      const errorStatus = downloadError.response?.status;
      let errorMessage = downloadError.message;
      let hint = undefined;
      
      if (errorStatus === 401) {
        errorMessage = 'File access denied (401). The file may be private or the upload preset may require authentication.';
        hint = 'To fix this:\n' +
               '1. Go to Cloudinary Dashboard > Settings > Upload\n' +
               '2. Find your upload preset "public_raw_upload"\n' +
               '3. Ensure "Signing Mode" is set to "Unsigned" OR "Signed" with proper configuration\n' +
               '4. Ensure "Access Mode" is set to "Public" for public files\n' +
               '5. For private files, use signed URLs by setting "Signing Mode" to "Signed"';
      }
      
      return res.status(errorStatus || 500).json({
        success: false,
        message: 'Error downloading file from Cloudinary',
        error: errorMessage,
        hint: hint,
        details: downloadError.response?.data || downloadError.message,
      });
    }
    
    if (!fileBuffer) {
      return res.status(500).json({
        success: false,
        message: 'Failed to download file content',
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
    res.setHeader('Content-Length', fileBuffer.length);

    // Send the file
    res.send(fileBuffer);
  } catch (error) {
    console.error('Error in downloadFile controller:', error);
    next(error);
  }
}

