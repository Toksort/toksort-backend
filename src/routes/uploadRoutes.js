import express from "express";
import upload from "../utils/multerConfig.js";

import {
  uploadCSV,
  getOrders,
  getGroupedOrdersCarryAware,
  getOrdersBySize,
  getSpecialOrders,
  getCourierTarpOrders,
  getUploadSummary,
  completeGroup,
  completePartial,
  getHistoryOrders,
  undoCompleteGroup,
} from "../controllers/csvController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Uploads
 *     description: Upload CSV dan batch processing
 *   - name: Orders
 *     description: Order processing, grouping, progress, dan completion
 *   - name: Analytics
 *     description: Summary dan aggregation endpoint
 */

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload CSV dan insert order ke database
 *     description: Upload file CSV, parsing data, normalisasi order, merge carry-over, lalu simpan ke database.
 *     tags: [Uploads]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File CSV dari TikTok Shop
 *     responses:
 *       200:
 *         description: Upload berhasil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 upload_id:
 *                   type: integer
 *                   example: 12
 *                 total:
 *                   type: integer
 *                   example: 45
 *                 carry_over:
 *                   type: integer
 *                   example: 3
 *                 debug:
 *                   type: object
 *                   properties:
 *                     raw:
 *                       type: integer
 *                       example: 50
 *                     cleaned:
 *                       type: integer
 *                       example: 45
 *       400:
 *         description: File kosong atau data tidak valid
 *       500:
 *         description: Server error
 */
router.post("/upload", upload.single("file"), uploadCSV);

/**
 * @swagger
 * /api/grouped-orders:
 *   get:
 *     summary: Dashboard aggregation order
 *     description: Mengambil grouping order berdasarkan normalized variation dan shipping_status, termasuk progress dan breakdown quantity.
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: upload_id
 *         required: false
 *         schema:
 *           type: integer
 *         description: Jika kosong, sistem memakai upload terbaru.
 *         example: 12
 *     responses:
 *       200:
 *         description: Data grouped orders berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 upload_id:
 *                   type: integer
 *                   example: 12
 *                 total_groups:
 *                   type: integer
 *                   example: 4
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       variation:
 *                         type: string
 *                         example: A5
 *                       shipping_status:
 *                         type: string
 *                         example: Kirim Hari ini
 *                       total_orders:
 *                         type: integer
 *                         example: 10
 *                       total_quantity:
 *                         type: integer
 *                         example: 120
 *                       total_processed:
 *                         type: integer
 *                         example: 70
 *                       total_remaining:
 *                         type: integer
 *                         example: 50
 *                       progress:
 *                         type: number
 *                         example: 58.33
 *                       breakdown:
 *                         type: object
 *                         properties:
 *                           not_started:
 *                             type: integer
 *                             example: 30
 *                           partial:
 *                             type: integer
 *                             example: 40
 *                           done:
 *                             type: integer
 *                             example: 50
 *       500:
 *         description: Server error
 */
router.get("/grouped-orders", getGroupedOrdersCarryAware);

/**
 * @swagger
 * /api/orders-by-size:
 *   get:
 *     summary: Group order berdasarkan A-series, ukuran, dan status kirim
 *     description: Mengambil data order yang dikelompokkan berdasarkan size_series seperti A2-A20, dimension seperti 100x50x25, lalu shipping_status. Cocok untuk tampilan frontend yang memisahkan A5 berdasarkan ukuran dan kirim hari ini/besok.
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: upload_id
 *         required: false
 *         schema:
 *           type: integer
 *         description: Jika kosong, sistem memakai upload terbaru.
 *         example: 12
 *     responses:
 *       200:
 *         description: Data grouped by size berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 upload_id:
 *                   type: integer
 *                   example: 12
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       size_series:
 *                         type: string
 *                         example: A5
 *                       dimensions:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             dimension:
 *                               type: string
 *                               example: 100x50x25
 *                             shipping:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   shipping_status:
 *                                     type: string
 *                                     example: today
 *                                   total_orders:
 *                                     type: integer
 *                                     example: 4
 *                                   total_quantity:
 *                                     type: integer
 *                                     example: 25
 *                                   total_processed:
 *                                     type: integer
 *                                     example: 10
 *                                   total_remaining:
 *                                     type: integer
 *                                     example: 15
 *                                   progress:
 *                                     type: number
 *                                     example: 40
 *       500:
 *         description: Server error
 */
router.get("/orders-by-size", getOrdersBySize);

/**
 * @swagger
 * /api/orders-special:
 *   get:
 *     summary: Group order Pembuangan Kolam Terpal
 *     description: Mengambil data produk pembuangan/penguras air kolam terpal berdasarkan variasi ukuran seperti 1/2 25 cm, 1/2 50 cm, 3/4 25 cm, dan 3/4 50 cm beserta status pengiriman.
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: upload_id
 *         required: false
 *         schema:
 *           type: integer
 *         description: Jika kosong, sistem memakai upload terbaru.
 *         example: 12
 *     responses:
 *       200:
 *         description: Data Pembuangan Kolam Terpal berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 upload_id:
 *                   type: integer
 *                   example: 12
 *                 total_categories:
 *                   type: integer
 *                   example: 1
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       special_category:
 *                         type: string
 *                         example: PEMBUANGAN_KOLAM_TERPAL
 *                       items:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             variation:
 *                               type: string
 *                               example: 3/4 50 cm
 *                             shipping:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   shipping_status:
 *                                     type: string
 *                                     example: today
 *                                   total_orders:
 *                                     type: integer
 *                                     example: 2
 *                                   total_quantity:
 *                                     type: integer
 *                                     example: 10
 *                                   total_processed:
 *                                     type: integer
 *                                     example: 4
 *                                   total_remaining:
 *                                     type: integer
 *                                     example: 6
 *                                   progress:
 *                                     type: number
 *                                     example: 40
 *       500:
 *         description: Server error
 */
router.get("/orders-special", getSpecialOrders);

/**
 * @swagger
 * /api/orders-courier-tarp:
 *   get:
 *     summary: Group order Karung Kurir
 *     description: Mengambil data Karung Kurir yang dikelompokkan berdasarkan jenis terpal A5, A8, A12, A15, A20, ukuran 50x100 sampai 90x100, dan status pengiriman.
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: upload_id
 *         required: false
 *         schema:
 *           type: integer
 *         description: Jika kosong, sistem memakai upload terbaru.
 *         example: 12
 *     responses:
 *       200:
 *         description: Data Karung Kurir berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 upload_id:
 *                   type: integer
 *                   example: 12
 *                 total_series:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       size_series:
 *                         type: string
 *                         example: A5
 *                       dimensions:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             dimension:
 *                               type: string
 *                               example: 50x100
 *                             shipping:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   shipping_status:
 *                                     type: string
 *                                     example: today
 *                                   total_orders:
 *                                     type: integer
 *                                     example: 3
 *                                   total_quantity:
 *                                     type: integer
 *                                     example: 15
 *                                   total_processed:
 *                                     type: integer
 *                                     example: 5
 *                                   total_remaining:
 *                                     type: integer
 *                                     example: 10
 *                                   progress:
 *                                     type: number
 *                                     example: 33.33
 *       500:
 *         description: Server error
 */
router.get("/orders-courier-tarp", getCourierTarpOrders);

/**
 * @swagger
 * /api/orders-summary:
 *   get:
 *     summary: Ringkasan order aktif per variation
 *     description: Mengambil sisa quantity berdasarkan variation untuk upload terbaru.
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Summary berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 upload_id:
 *                   type: integer
 *                   example: 12
 *                 total_variants:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       variation:
 *                         type: string
 *                         example: A5
 *                       remaining:
 *                         type: integer
 *                         example: 25
 *       500:
 *         description: Server error
 */
router.get("/orders-summary", getUploadSummary);

/**
 * @swagger
 * /api/summary:
 *   get:
 *     summary: Legacy summary endpoint
 *     description: Endpoint lama untuk kompatibilitas frontend. Gunakan /api/orders-summary untuk endpoint baru.
 *     tags: [Analytics]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Summary berhasil diambil
 */
router.get("/summary", getUploadSummary);

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Ambil order aktif
 *     description: Mengambil order dari upload terbaru yang belum selesai diproses.
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: variation
 *         required: false
 *         schema:
 *           type: string
 *         example: A5
 *       - in: query
 *         name: shipping_status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [today, tomorrow, "Kirim Hari ini", "Kirim Besok"]
 *         example: today
 *     responses:
 *       200:
 *         description: Order aktif berhasil diambil
 *       500:
 *         description: Server error
 */
router.get("/orders", getOrders);

/**
 * @swagger
 * /api/history:
 *   get:
 *     summary: Ambil history order terproses
 *     description: Mengambil order yang sudah diproses sebagian atau penuh.
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [done, partial]
 *         example: partial
 *       - in: query
 *         name: variation
 *         required: false
 *         schema:
 *           type: string
 *         example: A5
 *       - in: query
 *         name: shipping_status
 *         required: false
 *         schema:
 *           type: string
 *         example: today
 *     responses:
 *       200:
 *         description: History berhasil diambil
 *       500:
 *         description: Server error
 */
router.get("/history", getHistoryOrders);

/**
 * @swagger
 * /api/complete-group:
 *   post:
 *     summary: Selesaikan satu group order
 *     description: Menandai semua order dalam satu group variation + shipping_status sebagai selesai.
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - variation
 *               - shipping_status
 *             properties:
 *               upload_id:
 *                 type: integer
 *                 example: 12
 *               variation:
 *                 type: string
 *                 example: A5
 *               shipping_status:
 *                 type: string
 *                 example: today
 *     responses:
 *       200:
 *         description: Group berhasil diselesaikan
 *       400:
 *         description: Input tidak valid
 *       404:
 *         description: Upload tidak ditemukan
 *       500:
 *         description: Server error
 */
router.post("/complete-group", completeGroup);

/**
 * @swagger
 * /api/complete-partial:
 *   post:
 *     summary: Selesaikan sebagian quantity order
 *     description: Memproses quantity tertentu dari group variation + shipping_status.
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - variation
 *               - shipping_status
 *               - quantity
 *             properties:
 *               upload_id:
 *                 type: integer
 *                 example: 12
 *               variation:
 *                 type: string
 *                 example: A5
 *               shipping_status:
 *                 type: string
 *                 example: today
 *               quantity:
 *                 type: integer
 *                 example: 8
 *     responses:
 *       200:
 *         description: Partial completion berhasil
 *       400:
 *         description: Input tidak valid
 *       404:
 *         description: Upload tidak ditemukan
 *       500:
 *         description: Server error
 */
router.post("/complete-partial", completePartial);

/**
 * @swagger
 * /api/undo-group:
 *   post:
 *     summary: Undo complete group
 *     description: Mengembalikan group order yang sudah selesai menjadi pending.
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - upload_id
 *               - variation
 *               - shipping_status
 *             properties:
 *               upload_id:
 *                 type: integer
 *                 example: 12
 *               variation:
 *                 type: string
 *                 example: A5
 *               shipping_status:
 *                 type: string
 *                 example: today
 *     responses:
 *       200:
 *         description: Undo berhasil
 *       400:
 *         description: Input tidak valid
 *       500:
 *         description: Server error
 */
router.post("/undo-group", undoCompleteGroup);

export default router;