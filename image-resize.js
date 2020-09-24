/** @format */

"use strict";
const S3 = require("aws-sdk/clients/s3");
const Jimp = require("jimp");

const resizedImageFormats = {
  jpeg: Jimp.MIME_JPEG,
  png: Jimp.MIME_PNG,
  bmp: Jimp.MIME_BMP,
};

const prefix = process.env.IMAGE_RESIZE_PATH || "resized-images/";

const imageResize = async (s3Instance, bucket, key, watermarkImageUrl) => {
  try {
    let width = process.env.IMAGE_RESIZE_WIDTH
      ? parseInt(process.env.IMAGE_RESIZE_WIDTH)
      : Jimp.AUTO;
    let height = process.env.IMAGE_RESIZE_HEIGHT
      ? parseInt(process.env.IMAGE_RESIZE_HEIGHT)
      : Jimp.AUTO;

    if (!process.env.IMAGE_RESIZE_WIDTH && !process.env.IMAGE_RESIZE_HEIGHT) {
      width = 100;
    }

    const resizedImageFormat = process.env.IMAGE_RESIZE_FORMAT || "jpeg";

    if (!(resizedImageFormat in resizedImageFormats)) {
      throw new Error("Unsupported MIME type.");
    }

    const response = await s3Instance
      .getObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();

    const image = await Jimp.read(response.Body);

    image.resize(width, height);

    const buffer = await image.getBufferAsync(
      resizedImageFormats[resizedImageFormat]
    );

    await s3Instance
      .upload({
        Bucket: bucket,
        Key: `${prefix}${key}`,
        Body: buffer,
        ContentType: resizedImageFormats[resizedImageFormat],
      })
      .promise();
  } catch (error) {
    throw error;
  }
};

const getS3Configuration = (sourceBucket) => {
  return {
    accessKeyId: process.env[`KOYEB_STORE_${sourceBucket}_ACCESS_KEY`],
    secretAccessKey: process.env[`KOYEB_STORE_${sourceBucket}_SECRET_KEY`],
    region: process.env[`KOYEB_STORE_${sourceBucket}_REGION`],
    endpoint: process.env[`KOYEB_STORE_${sourceBucket}_ENDPOINT`],
  };
};

const validateEnvironment = (sourceBucket) => {
  if (!sourceBucket) {
    throw new Error("Bucket name not present in event payload.");
  }

  if (
    !process.env?.[`KOYEB_STORE_${sourceBucket}_ACCESS_KEY`] ||
    !process.env?.[`KOYEB_STORE_${sourceBucket}_SECRET_KEY`] ||
    !process.env?.[`KOYEB_STORE_${sourceBucket}_REGION`] ||
    !process.env?.[`KOYEB_STORE_${sourceBucket}_ENDPOINT`]
  ) {
    throw new Error(
      `One of the following environment variables are missing: KOYEB_STORE_${sourceBucket}_ACCESS_KEY, KOYEB_STORE_${sourceBucket}_SECRET_KEY, KOYEB_STORE_${sourceBucket}_ENDPOINT, KOYEB_STORE_${sourceBucket}_REGION.`
    );
  }

  if (!process.env?.IMAGE_RESIZE_WIDTH && !process.env?.IMAGE_RESIZE_HEIGHT) {
    console.log(
      `None of the following environment variables are defined: IMAGE_RESIZE_WIDTH, IMAGE_RESIZE_HEIGHT. Image will be resized using a default width value of 100px.`
    );
  }
};

const handler = async (event) => {
  const bucket = event?.bucket?.name;
  const key = event?.object?.key;

  if (key.startsWith(prefix)) {
    return;
  }

  validateEnvironment(bucket);

  const s3Instance = new S3(getS3Configuration(bucket));

  await imageResize(s3Instance, bucket, key);
};

module.exports.handler = handler;
