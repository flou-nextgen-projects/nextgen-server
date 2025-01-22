/**
 * @swagger
 * tags:
 *   name: Project
 *   description: Project Management and Operations
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /backend/main/api/project-master/docs:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get project documents
 *     tags: [Project]
 *     parameters:
 *       - in: query
 *         name: pid
 *         schema:
 *           type: string
 *         required: true
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project documents retrieved successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/project-master/get-all:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get all projects
 *     tags: [Project]
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: Filter criteria
 *     responses:
 *       200:
 *         description: Projects retrieved successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/project-master/get-process-stages:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get process stages for a project
 *     tags: [Project]
 *     parameters:
 *       - in: query
 *         name: pid
 *         schema:
 *           type: string
 *         required: true
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Process stages retrieved successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/project-master/nodes-and-links/{pid}:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get nodes and links for a project
 *     tags: [Project]
 *     parameters:
 *       - in: path
 *         name: pid
 *         schema:
 *           type: string
 *         required: true
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Nodes and links retrieved successfully
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/project-master/reprocess-network-connectivity/{wid}:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Reprocess network connectivity for a workspace
 *     tags: [Project]
 *     parameters:
 *       - in: path
 *         name: wid
 *         schema:
 *           type: string
 *         required: true
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Network connectivity reprocessed successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/project-master/reprocess-file-contents/{wid}:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Reprocess file contents for a workspace
 *     tags: [Project]
 *     parameters:
 *       - in: path
 *         name: wid
 *         schema:
 *           type: string
 *         required: true
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: File contents reprocessed successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/project-master/reprocess-file-details/{wid}:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Reprocess file details for a workspace
 *     tags: [Project]
 *     parameters:
 *       - in: path
 *         name: wid
 *         schema:
 *           type: string
 *         required: true
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: File details reprocessed successfully
 *       404:
 *         description: Workspace not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/project-master/add-project:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Add a new project
 *     tags: [Project]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Project added successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/project-master:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Add a new project and extract project zip
 *     tags: [Project]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Project added and zip extracted successfully
 *       202:
 *         description: Project with same name already exists
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/project-master/upload-project:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Upload a project
 *     tags: [Project]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Project uploaded successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/project-master/upload-project-bundle:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Upload a project bundle
 *     tags: [Project]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Project bundle uploaded successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /backend/main/api/project-master/add-member-ref:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Add member references
 *     tags: [Project]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Member references added successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */