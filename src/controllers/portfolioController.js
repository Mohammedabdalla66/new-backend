import { Portfolio } from '../models/Portfolio.js';

// Create a new portfolio item
export async function createPortfolioItem(req, res, next) {
  try {
    const userId = req.user.sub;
    const { type, title, description, tags, date, client, industry, duration, results, issuer, expiry, credentialId, status } = req.body;
    
    // Validate required fields
    if (!type || !title) {
      return res.status(400).json({ 
        success: false, 
        message: 'Type and title are required' 
      });
    }
    
    if (!['work', 'case', 'cert'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid type. Must be: work, case, or cert' 
      });
    }
    
    // Handle file uploads to Cloudinary
    const uploadedFiles = [];
    const files = req.files || [];
    
    if (files.length > 0) {
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.warn('Cloudinary not configured - files will not be uploaded');
      } else {
        try {
          const { uploadToCloudinary } = await import('../config/cloudinary.js');
          
          for (const file of files) {
            try {
              console.log(`Uploading portfolio file: ${file.originalname} (${file.size} bytes)`);
              const folder = `accountax/portfolio/${userId}`;
              const result = await uploadToCloudinary(file, folder);
              
              // Determine file type
              let fileType = 'file';
              if (file.mimetype.startsWith('image/')) {
                fileType = 'image';
              } else if (file.mimetype === 'application/pdf') {
                fileType = 'pdf';
              } else if (file.mimetype.includes('document') || file.mimetype.includes('word') || file.mimetype.includes('excel')) {
                fileType = 'document';
              }
              
              uploadedFiles.push({
                name: file.originalname,
                url: result.secure_url,
                publicId: result.public_id,
                type: fileType,
                size: file.size
              });
              console.log(`File uploaded successfully: ${result.secure_url}`);
            } catch (uploadError) {
              console.error('Error uploading file to Cloudinary:', uploadError);
              // Continue with other files even if one fails
            }
          }
        } catch (importError) {
          console.error('Error importing Cloudinary module:', importError);
        }
      }
    }
    
    // Parse tags if it's a string
    let tagsArray = [];
    if (tags) {
      if (typeof tags === 'string') {
        tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
    }
    
    // Parse results if it's a string
    let resultsArray = [];
    if (results) {
      if (typeof results === 'string') {
        resultsArray = results.split(',').map(r => r.trim()).filter(r => r);
      } else if (Array.isArray(results)) {
        resultsArray = results;
      }
    }
    
    // Create portfolio item
    const portfolioData = {
      userId,
      type,
      title: String(title),
      description: description || '',
      tags: tagsArray,
      files: uploadedFiles,
      date: date ? new Date(date) : new Date()
    };
    
    // Add type-specific fields
    if (type === 'case') {
      if (client) portfolioData.client = String(client);
      if (industry) portfolioData.industry = String(industry);
      if (duration) portfolioData.duration = String(duration);
      if (resultsArray.length > 0) portfolioData.results = resultsArray;
    } else if (type === 'cert') {
      if (issuer) portfolioData.issuer = String(issuer);
      if (expiry) portfolioData.expiry = new Date(expiry);
      if (credentialId) portfolioData.credentialId = String(credentialId);
      if (status) portfolioData.status = status;
    }
    
    const portfolioItem = await Portfolio.create(portfolioData);
    
    console.log('✅ Portfolio item created:', portfolioItem._id);
    
    res.status(201).json({
      success: true,
      data: portfolioItem,
      message: 'Portfolio item created successfully'
    });
  } catch (err) {
    console.error('Error creating portfolio item:', err);
    next(err);
  }
}

// Get all portfolio items for logged-in user
export async function getMyPortfolioItems(req, res, next) {
  try {
    const userId = req.user.sub;
    const { type } = req.query; // Optional filter by type
    
    const filter = { userId };
    if (type && ['work', 'case', 'cert'].includes(type)) {
      filter.type = type;
    }
    
    const items = await Portfolio.find(filter)
      .sort('-createdAt');
    
    res.json({
      success: true,
      data: items
    });
  } catch (err) {
    console.error('Error fetching portfolio items:', err);
    next(err);
  }
}

// Get single portfolio item
export async function getPortfolioItem(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    
    const item = await Portfolio.findOne({ _id: id, userId });
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }
    
    res.json({
      success: true,
      data: item
    });
  } catch (err) {
    console.error('Error fetching portfolio item:', err);
    next(err);
  }
}

// Update portfolio item
export async function updatePortfolioItem(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const { title, description, tags, date, client, industry, duration, results, issuer, expiry, credentialId, status } = req.body;
    
    const item = await Portfolio.findOne({ _id: id, userId });
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }
    
    // Handle new file uploads
    const newFiles = [];
    const files = req.files || [];
    
    if (files.length > 0) {
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        try {
          const { uploadToCloudinary } = await import('../config/cloudinary.js');
          
          for (const file of files) {
            try {
              const folder = `accountax/portfolio/${userId}`;
              const result = await uploadToCloudinary(file, folder);
              
              let fileType = 'file';
              if (file.mimetype.startsWith('image/')) {
                fileType = 'image';
              } else if (file.mimetype === 'application/pdf') {
                fileType = 'pdf';
              } else if (file.mimetype.includes('document') || file.mimetype.includes('word') || file.mimetype.includes('excel')) {
                fileType = 'document';
              }
              
              newFiles.push({
                name: file.originalname,
                url: result.secure_url,
                publicId: result.public_id,
                type: fileType,
                size: file.size
              });
            } catch (uploadError) {
              console.error('Error uploading file:', uploadError);
            }
          }
        } catch (importError) {
          console.error('Error importing Cloudinary:', importError);
        }
      }
    }
    
    // Parse tags and results
    let tagsArray = item.tags || [];
    if (tags !== undefined) {
      if (typeof tags === 'string') {
        tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
    }
    
    let resultsArray = item.results || [];
    if (results !== undefined) {
      if (typeof results === 'string') {
        resultsArray = results.split(',').map(r => r.trim()).filter(r => r);
      } else if (Array.isArray(results)) {
        resultsArray = results;
      }
    }
    
    // Update fields
    if (title) item.title = String(title);
    if (description !== undefined) item.description = String(description);
    if (tags !== undefined) item.tags = tagsArray;
    if (date) item.date = new Date(date);
    if (newFiles.length > 0) {
      item.files = [...item.files, ...newFiles];
    }
    
    // Update type-specific fields
    if (item.type === 'case') {
      if (client !== undefined) item.client = client ? String(client) : '';
      if (industry !== undefined) item.industry = industry ? String(industry) : '';
      if (duration !== undefined) item.duration = duration ? String(duration) : '';
      if (results !== undefined) item.results = resultsArray;
    } else if (item.type === 'cert') {
      if (issuer !== undefined) item.issuer = issuer ? String(issuer) : '';
      if (expiry !== undefined) item.expiry = expiry ? new Date(expiry) : null;
      if (credentialId !== undefined) item.credentialId = credentialId ? String(credentialId) : '';
      if (status !== undefined) item.status = status;
    }
    
    await item.save();
    
    res.json({
      success: true,
      data: item,
      message: 'Portfolio item updated successfully'
    });
  } catch (err) {
    console.error('Error updating portfolio item:', err);
    next(err);
  }
}

// Delete portfolio item and its Cloudinary files
export async function deletePortfolioItem(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    
    const item = await Portfolio.findOne({ _id: id, userId });
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }
    
    // Delete files from Cloudinary
    if (item.files && item.files.length > 0) {
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        try {
          const { v2: cloudinary } = await import('cloudinary');
          
          for (const file of item.files) {
            if (file.publicId) {
              try {
                await cloudinary.uploader.destroy(file.publicId);
                console.log(`Deleted file from Cloudinary: ${file.publicId}`);
              } catch (deleteError) {
                console.error(`Error deleting file ${file.publicId}:`, deleteError);
                // Continue even if deletion fails
              }
            }
          }
        } catch (importError) {
          console.error('Error importing Cloudinary:', importError);
        }
      }
    }
    
    await Portfolio.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Portfolio item deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting portfolio item:', err);
    next(err);
  }
}

// Delete a specific file from a portfolio item
export async function deletePortfolioFile(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id, fileIndex } = req.params;
    
    const item = await Portfolio.findOne({ _id: id, userId });
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio item not found'
      });
    }
    
    const fileIndexNum = parseInt(fileIndex);
    if (fileIndexNum < 0 || fileIndexNum >= item.files.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file index'
      });
    }
    
    const fileToDelete = item.files[fileIndexNum];
    
    // Delete from Cloudinary
    if (fileToDelete.publicId) {
      try {
        const { v2: cloudinary } = await import('cloudinary');
        await cloudinary.uploader.destroy(fileToDelete.publicId);
        console.log(`Deleted file from Cloudinary: ${fileToDelete.publicId}`);
      } catch (deleteError) {
        console.error('Error deleting file from Cloudinary:', deleteError);
      }
    }
    
    // Remove file from array
    item.files.splice(fileIndexNum, 1);
    await item.save();
    
    res.json({
      success: true,
      data: item,
      message: 'File deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting portfolio file:', err);
    next(err);
  }
}

