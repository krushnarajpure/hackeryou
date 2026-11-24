const fs = require('fs');
const mongoose = require('mongoose');

const bucketName = 'mediaFiles';

const getBucket = () => {
  if (!mongoose.connection.db) throw new Error('MongoDB media storage is unavailable');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });
};

const storeMediaFile = (file, metadata = {}) => {
  const bucket = getBucket();
  const uploadStream = bucket.openUploadStream(file.filename, { metadata });
  const source = fs.createReadStream(file.path);

  return new Promise((resolve, reject) => {
    const fail = (error) => {
      source.destroy();
      reject(error);
    };
    source.once('error', fail);
    uploadStream.once('error', fail);
    uploadStream.once('finish', () => resolve(uploadStream.id));
    source.pipe(uploadStream);
  });
};

const deleteMediaFile = (fileId) => getBucket().delete(fileId);
const openMediaFile = (fileId) => getBucket().openDownloadStream(fileId);

module.exports = { storeMediaFile, deleteMediaFile, openMediaFile };
