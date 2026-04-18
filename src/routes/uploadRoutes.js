import express from "express";
import upload from "../utils/multerConfig.js";
import {
  uploadCSV,
  getCSVHistory,
  readCSV,
  deleteFile,
  getAllFiles,
  readLatestCSV
} from "../controllers/csvController.js";
import { deleteOldFiles, checkDailyLimit } from "../utils/fileCleaner.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: CSV
 *   description: CSV Management API
 */

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: Ambil semua file CSV
 *     tags: [CSV]
 */
router.get("/files", getAllFiles);

/**
 * @swagger
 * /api/read-latest:
 *   get:
 *     summary: Ambil data CSV terbaru
 *     tags: [CSV]
 */
router.get("/read-latest", readLatestCSV);

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload file CSV
 *     tags: [CSV]
 */
router.post(
  "/upload",
  (req, res, next) => {
    deleteOldFiles();

    if (checkDailyLimit()) {
      return res.status(429).json({
        success: false,
        message: "Upload limit reached (max 10 files/day)",
      });
    }

    next();
  },
  upload.single("file"),
  uploadCSV
);

/**
 * @swagger
 * /api/history:
 *   get:
 *     summary: Ambil history upload CSV
 *     tags: [CSV]
 */
router.get("/history", getCSVHistory);

/**
 * @swagger
 * /api/read/{filename}:
 *   get:
 *     summary: Ambil data CSV berdasarkan filename
 *     tags: [CSV]
 */
router.get("/read/:filename", readCSV);

/**
 * @swagger
 * /api/delete/{filename}:
 *   delete:
 *     summary: Hapus file CSV
 *     tags: [CSV]
 */
router.delete("/delete/:filename", deleteFile);

export default router;