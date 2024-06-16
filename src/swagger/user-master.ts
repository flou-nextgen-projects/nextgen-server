/**
 * @swagger
 * /backend/main/api/user-master/get-all:
 *   get:
 *     summary: Retrieve a list of users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve a list of users. Can be used to populate a list of fake users when prototyping or testing an API client.
 *     responses:
 *       200:
 *         description: A list of users.
 */

/**
 * @swagger
 * /backend/api/user-master/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Users] 
 *     description: Log in a user by using their username and password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userName
 *               - password
 *             properties:
 *               userName:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: A user object along with a JWT token. 
 *       401:
 *         description: Authentication failed, possible invalid username or password.
 */