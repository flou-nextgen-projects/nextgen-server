
/** 
 * 
 * security:
 *   - bearerAuth: []
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /:
 *   post:
 *     security:
 *       - bearerAuth: [] 
 *     summary: Add new file type
 *     tags: [File Types]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json: 
 *     responses:
 *       200:
 *         description: File type added successfully 
 *       500:
 *         description: Some server error
 */

/**
 * @swagger
 * paths:
 *   /backend/main/api/file-type-master:
 *     get:
 *       security:
 *         - bearerAuth: [] 
 *       summary: Get all file types
 *       tags: 
 *         - File Types
 *       responses:
 *         200:
 *           description: File types retrieved successfully 
 *         500:
 *           description: Some server error
 */
