
/**
 * @swagger
 * /backend/api/home/get-status:
 *   get:
 *     tags: [Home]
 *     summary: Get API status
 *     responses:
 *       200:
 *         description: API is up and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 status:
 *                   type: string
 */

/**
 * @swagger
 * /backend/api/home/live:
 *   get:
 *     tags: [Home]
 *     summary: Get live status
 *     responses:
 *       200:
 *         description: API is up and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 status:
 *                   type: string
 */

/**
 * @swagger
 * /backend/api/home/ready:
 *   get:
 *     tags: [Home]
 *     summary: Get readiness status
 *     responses:
 *       200:
 *         description: API is up and ready to receive requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 status:
 *                   type: string
 */