/**
 * @swagger
 * tags:
 *   name: Role Master
 *   description: Role management
 */

/**
 * @swagger
 * /backend/main/api/role-master:
 *   post:
 *     summary: Add a new role
 *     tags: [Role Master]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the role
 *                 example: Admin
 *     responses:
 *       200:
 *         description: The role was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: The role ID
 *                   example: 60d0fe4f5311236168a109ca
 *                 name:
 *                   type: string
 *                   description: The name of the role
 *                   example: Admin
 *       500:
 *         description: Some server error
 */

/**
 * @swagger
 * /backend/main/api/role-master:
 *   get:
 *     summary: Get all roles
 *     tags: [Role Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: Filter criteria in JSON format
 *     responses:
 *       200:
 *         description: The list of roles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: The role ID
 *                     example: 60d0fe4f5311236168a109ca
 *                   name:
 *                     type: string
 *                     description: The name of the role
 *                     example: Admin
 *       500:
 *         description: Some server error
 */