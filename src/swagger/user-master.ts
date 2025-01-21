/**
 * @swagger
 * tags:
 *   name: User
 *   description: User management and operations
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /backend/main/api/user-master/get-all:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get all users
 *     tags: [User]
 *     responses:
 *       200:
 *         description: List of users
 *       404:
 *         description: Not found
 */

/**
 * @swagger
 * /backend/main/api/user-master/get-roles:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get all roles
 *     tags: [User]
 *     responses:
 *       200:
 *         description: List of roles
 *       404:
 *         description: Not found
 */

/**
 * @swagger
 * /backend/main/api/user-master/get-users-by-roleId/{id}:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get users by role ID
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Role ID
 *     responses:
 *       200:
 *         description: List of users with the specified role ID
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/user-master/search-user:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Search users by keyword
 *     tags: [User]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         required: true
 *         description: Keyword to search users
 *     responses:
 *       200:
 *         description: List of users matching the keyword
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/user-master/:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Register a new user
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               roleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 */

/**
 * @swagger
 * /backend/main/api/user-master/upload:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Upload user data
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Upload successful
 */

/**
 * @swagger
 * /backend/main/api/user-master/update-user:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Update user information
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *               userName:
 *                 type: string
 *               email:
 *                 type: string
 *               roleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/user-master/forgot-password:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Forgot password
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: User found and email sent
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/user-master/update-profile-img:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Update profile image
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               imgId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile image updated successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/user-master/get-profile-img:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Get profile image
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile image retrieved successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/user-master/change-password:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Change user password
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userName:
 *                 type: string
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Old password is incorrect
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */