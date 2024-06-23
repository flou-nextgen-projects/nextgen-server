/**
 * @swagger
 * /backend/main/api/topics/list-topics:
 *   get:
 *     summary: Retrieve a list of Kafka Topics
 *     tags: [Kafka]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve a list of all Kafka Topics.
 *     responses:
 *       200:
 *         description: A list of kafka topics.
 */