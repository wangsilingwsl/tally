import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/** 支持的图片 MIME 类型 */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** MIME 类型到文件扩展名的映射 */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** 缩略图宽度（像素） */
const THUMBNAIL_WIDTH = 300;

/** 上传目录基础路径 */
const UPLOADS_BASE = path.resolve('uploads');
const ORIGINALS_DIR = path.join(UPLOADS_BASE, 'originals');
const THUMBNAILS_DIR = path.join(UPLOADS_BASE, 'thumbnails');

/** 路由参数类型 */
interface ItemParams {
  itemId: string;
}

interface ImageParams {
  id: string;
}

/**
 * 确保上传目录存在
 */
function ensureUploadDirs(): void {
  fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

/**
 * 图片管理路由模块
 * 提供图片上传、删除、获取缩略图和原图接口
 */
export default async function imageRoutes(fastify: FastifyInstance) {
  // 启动时确保上传目录存在
  ensureUploadDirs();

  /**
   * POST /api/items/:itemId/images - 上传图片
   * 接收 multipart/form-data，校验格式和大小，生成缩略图
   */
  fastify.post<{ Params: ItemParams }>(
    '/api/items/:itemId/images',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { itemId } = request.params;

      // 校验物品是否存在且属于当前用户
      const item = await fastify.prisma.item.findFirst({
        where: { id: itemId, userId, isDeleted: false },
      });

      if (!item) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '物品不存在',
        });
      }

      // 获取上传文件
      let data;
      try {
        data = await request.file();
      } catch (err: any) {
        // multipart 插件在文件超过限制时抛出错误
        if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.status(413).send({
            error: 'FILE_TOO_LARGE',
            message: '文件大小超过 5MB 限制',
          });
        }
        throw err;
      }

      if (!data) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: '请选择要上传的图片文件',
        });
      }

      // 校验文件格式
      if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
        // 消费掉文件流，避免挂起
        await data.toBuffer();
        return reply.status(415).send({
          error: 'UNSUPPORTED_FORMAT',
          message: '仅支持 JPEG、PNG、WebP 格式',
        });
      }

      // 读取文件内容
      const buffer = await data.toBuffer();

      // 校验文件大小（双重保险，multipart 插件已有限制）
      const MAX_SIZE = 5 * 1024 * 1024;
      if (buffer.length > MAX_SIZE) {
        return reply.status(413).send({
          error: 'FILE_TOO_LARGE',
          message: '文件大小超过 5MB 限制',
        });
      }

      // 生成文件名
      const fileId = randomUUID();
      const ext = MIME_TO_EXT[data.mimetype];
      const originalFilename = `${fileId}.${ext}`;
      const thumbnailFilename = `${fileId}.${ext}`;

      const originalPath = path.join(ORIGINALS_DIR, originalFilename);
      const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

      // 保存原图
      fs.writeFileSync(originalPath, buffer);

      // 使用 sharp 生成 300px 宽缩略图
      await sharp(buffer)
        .resize({ width: THUMBNAIL_WIDTH })
        .toFile(thumbnailPath);

      // 创建数据库记录
      const image = await fastify.prisma.image.create({
        data: {
          itemId,
          originalPath: `originals/${originalFilename}`,
          thumbnailPath: `thumbnails/${thumbnailFilename}`,
          mimeType: data.mimetype,
          size: buffer.length,
        },
        select: {
          id: true,
          itemId: true,
          originalPath: true,
          thumbnailPath: true,
          mimeType: true,
          size: true,
          createdAt: true,
        },
      });

      return reply.status(201).send({ image });
    },
  );

  /**
   * DELETE /api/images/:id - 删除图片
   * 校验图片所属物品归属当前用户，删除文件和数据库记录
   */
  fastify.delete<{ Params: ImageParams }>(
    '/api/images/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;

      // 查询图片及其关联物品
      const image = await fastify.prisma.image.findUnique({
        where: { id },
        include: { item: { select: { userId: true } } },
      });

      if (!image) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '图片不存在',
        });
      }

      // 校验物品归属
      if (image.item.userId !== userId) {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: '无权操作此图片',
        });
      }

      // 删除磁盘文件（忽略文件不存在的错误）
      const originalFile = path.join(UPLOADS_BASE, image.originalPath);
      const thumbnailFile = path.join(UPLOADS_BASE, image.thumbnailPath);

      try { fs.unlinkSync(originalFile); } catch { /* 文件可能已不存在 */ }
      try { fs.unlinkSync(thumbnailFile); } catch { /* 文件可能已不存在 */ }

      // 删除数据库记录
      await fastify.prisma.image.delete({ where: { id } });

      return reply.send({ message: '图片已删除' });
    },
  );

  /**
   * GET /api/images/:id/thumbnail - 获取缩略图
   * 返回文件流，设置正确的 Content-Type
   */
  fastify.get<{ Params: ImageParams }>(
    '/api/images/:id/thumbnail',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;

      const image = await fastify.prisma.image.findUnique({
        where: { id },
        include: { item: { select: { userId: true } } },
      });

      if (!image) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '图片不存在',
        });
      }

      if (image.item.userId !== userId) {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: '无权访问此图片',
        });
      }

      const filePath = path.join(UPLOADS_BASE, image.thumbnailPath);

      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '缩略图文件不存在',
        });
      }

      const stream = fs.createReadStream(filePath);
      return reply.type(image.mimeType).send(stream);
    },
  );

  /**
   * GET /api/images/:id/original - 获取原图
   * 返回文件流，设置正确的 Content-Type
   */
  fastify.get<{ Params: ImageParams }>(
    '/api/images/:id/original',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;

      const image = await fastify.prisma.image.findUnique({
        where: { id },
        include: { item: { select: { userId: true } } },
      });

      if (!image) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '图片不存在',
        });
      }

      if (image.item.userId !== userId) {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: '无权访问此图片',
        });
      }

      const filePath = path.join(UPLOADS_BASE, image.originalPath);

      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: '原图文件不存在',
        });
      }

      const stream = fs.createReadStream(filePath);
      return reply.type(image.mimeType).send(stream);
    },
  );
}
