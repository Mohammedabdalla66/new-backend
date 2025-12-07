# Temporary Cloudinary Upload Preset Rollback

## Issue
Cloudinary flagged the account as untrusted, causing all assets uploaded using the `public_raw_upload` preset to be blocked for delivery and return HTTP 401 errors. This prevents opening or downloading files even when settings are correct.

**Status**: Cloudinary Support has been contacted. Waiting for trust review and whitelist approval.

## Temporary Fix Applied

### Changes Made

1. **Removed Upload Preset Usage** (`backend/src/controllers/requestController.js`)
   - Removed `upload_preset: 'public_raw_upload'` from both `createRequest` and `updateRequest` functions
   - Files now upload using basic Cloudinary settings without the preset
   - Added comments explaining this is temporary

2. **Upload Configuration**
   - Still using `resource_type: 'raw'`
   - Still using folder: `accountax/requests`
   - Files upload successfully but may not preserve original filename/extension
   - Download endpoint handles extension appending manually

3. **Download Endpoint**
   - Already handles files without extensions properly
   - Automatically appends extension from fileInfo.format when available
   - Can also use filename from attachment name stored in database

### Current Behavior

- ✅ Files upload successfully (HTTP 200)
- ✅ Files download successfully (HTTP 200)
- ⚠️ Filenames/extensions may not be preserved in Cloudinary public_id
- ✅ Download endpoint appends extensions manually when needed

## Testing

After applying this fix:
1. Upload a new PDF file through the request creation form
2. Verify the file uploads without errors
3. Try to download the file - it should work without HTTP 401
4. Verify the downloaded file has the correct extension

## Next Steps

### Once Cloudinary Support Resolves Trust Block

1. **Restore Upload Preset** in `backend/src/controllers/requestController.js`:
   ```javascript
   const result = await uploadToCloudinary(file, 'accountax/requests', {
     upload_preset: 'public_raw_upload',
     resource_type: 'raw',
   });
   ```

2. **Verify Cloudinary Dashboard Settings** for `public_raw_upload` preset:
   - Signing Mode: Should be properly configured
   - Access Mode: Public
   - Resource Type: Raw
   - Folder: accountax/requests

3. **Test Upload and Download** to ensure everything works with the preset restored

## Files Modified

- `backend/src/controllers/requestController.js` - Removed upload preset from 2 locations
- No other files were changed

## Notes

- **DO NOT DELETE** existing uploaded files - the issue is with account trust status, not file structure
- All existing files remain in Cloudinary and will work once the trust block is removed
- This is a temporary workaround until Cloudinary Support resolves the account trust issue



