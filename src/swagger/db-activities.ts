/**
 * @swagger
 * /backend/super/admin/db/check-status:
 *   get:
 *     summary: Check the status of the database
 *     tags: [Database Activities]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database status checked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 * /backend/super/admin/db/restore-database:
 *   get:
 *     summary: Restore the database to its initial state
 *     tags: [Database Activities]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database restored successfully
 *       500:
 *         description: Internal server error
 */