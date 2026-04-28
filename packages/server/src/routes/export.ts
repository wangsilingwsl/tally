import { FastifyInstance } from 'fastify';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/** 导出请求体类型 */
interface ExportBody {
  categoryId?: string;
  status?: 'IN_USE' | 'IDLE' | 'SOLD' | 'DISCARDED';
  tags?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
}

/** 物品状态中文映射 */
const STATUS_MAP: Record<string, string> = {
  IN_USE: '使用中',
  IDLE: '闲置',
  SOLD: '已出售',
  DISCARDED: '已丢弃',
};

/** 价格值转 number（兼容处理） */
function toNumber(val: number | null | undefined): number {
  if (val == null) return 0;
  return Number(val);
}

/** 计算日均成本 */
function calcDailyCost(purchasePrice: number, purchaseDate: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - purchaseDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return purchasePrice;
  return Math.round((purchasePrice / diffDays) * 100) / 100;
}

/** 格式化日期为 YYYY-MM-DD */
function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

/**
 * 根据筛选条件查询物品数据
 */
async function queryItems(fastify: FastifyInstance, userId: string, body: ExportBody) {
  // 构建 Prisma 查询条件
  const where: Record<string, unknown> = {
    userId,
    isDeleted: false,
  };

  if (body.categoryId) {
    where.categoryId = body.categoryId;
  }

  if (body.status) {
    where.status = body.status;
  }

  // 日期范围筛选（基于 purchaseDate）
  if (body.dateRange) {
    const dateFilter: Record<string, Date> = {};
    if (body.dateRange.start) {
      dateFilter.gte = new Date(body.dateRange.start);
    }
    if (body.dateRange.end) {
      dateFilter.lte = new Date(body.dateRange.end);
    }
    if (Object.keys(dateFilter).length > 0) {
      where.purchaseDate = dateFilter;
    }
  }

  // 标签筛选：查询包含指定标签的物品
  if (body.tags && body.tags.length > 0) {
    where.itemTags = {
      some: {
        tag: {
          name: { in: body.tags },
        },
      },
    };
  }

  const items = await fastify.prisma.item.findMany({
    where,
    include: {
      category: { select: { name: true } },
      itemTags: {
        include: {
          tag: { select: { name: true } },
        },
      },
    },
    orderBy: { purchaseDate: 'desc' },
  });

  return items;
}

/**
 * 导出模块路由
 * 提供 Excel 和 PDF 两种格式的物品数据导出
 */
export default async function exportRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/export/excel - 导出 Excel 文件
   */
  fastify.post<{ Body: ExportBody }>(
    '/api/export/excel',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const body = request.body || {};

      const items = await queryItems(fastify, userId, body);

      // 无数据时返回提示，不生成空文件
      if (items.length === 0) {
        return reply.status(200).send({ message: '暂无数据可导出' });
      }

      // 创建工作簿和工作表
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('物品清单');

      // 定义列
      worksheet.columns = [
        { header: '名称', key: 'name', width: 20 },
        { header: '品牌', key: 'brand', width: 15 },
        { header: '型号', key: 'model', width: 15 },
        { header: '购买日期', key: 'purchaseDate', width: 14 },
        { header: '购买价格', key: 'purchasePrice', width: 12 },
        { header: '购买渠道', key: 'purchaseChannel', width: 15 },
        { header: '二手回收价', key: 'resalePrice', width: 12 },
        { header: '物品状态', key: 'status', width: 10 },
        { header: '分类', key: 'category', width: 12 },
        { header: '标签', key: 'tags', width: 20 },
        { header: '日均成本', key: 'dailyCost', width: 12 },
        { header: '保修到期日期', key: 'warrantyDate', width: 14 },
      ];

      // 设置表头样式
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center' };

      // 填充数据行
      for (const item of items) {
        const price = toNumber(item.purchasePrice);
        const resaleRaw = item.resalePrice;
        const tagNames = item.itemTags.map((it) => it.tag.name).join(', ');

        worksheet.addRow({
          name: item.name,
          brand: item.brand || '',
          model: item.model || '',
          purchaseDate: formatDate(item.purchaseDate),
          purchasePrice: price,
          purchaseChannel: item.purchaseChannel || '',
          resalePrice: resaleRaw != null ? toNumber(resaleRaw) : '',
          status: STATUS_MAP[item.status] || item.status,
          category: item.category?.name || '未分类',
          tags: tagNames,
          dailyCost: calcDailyCost(price, item.purchaseDate),
          warrantyDate: formatDate(item.warrantyDate),
        });
      }

      // 生成 Buffer
      const buffer = await workbook.xlsx.writeBuffer();

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', 'attachment; filename="tally-export.xlsx"')
        .send(Buffer.from(buffer));
    },
  );

  /**
   * POST /api/export/pdf - 导出 PDF 文件
   */
  fastify.post<{ Body: ExportBody }>(
    '/api/export/pdf',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const body = request.body || {};

      const items = await queryItems(fastify, userId, body);

      // 无数据时返回提示，不生成空文件
      if (items.length === 0) {
        return reply.status(200).send({ message: '暂无数据可导出' });
      }

      // 生成 PDF
      const pdfBuffer = await generatePDF(items);

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', 'attachment; filename="tally-export.pdf"')
        .send(pdfBuffer);
    },
  );
}

/**
 * 生成 PDF 文件 Buffer
 * 使用 PDFKit 创建格式化清单报告
 */
function generatePDF(items: Awaited<ReturnType<typeof queryItems>>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      info: {
        Title: 'Tally Export',
        Author: 'Tally',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // 使用 Helvetica（内置字体），中文字符可能显示为方块
    // 生产环境建议嵌入中文字体文件
    const font = 'Helvetica';
    const fontBold = 'Helvetica-Bold';

    // 标题
    doc.font(fontBold).fontSize(16).text('Tally - Items Export Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.font(font).fontSize(9).text(`Export Date: ${formatDate(new Date())}  |  Total: ${items.length} items`, { align: 'center' });
    doc.moveDown(0.8);

    // 表格列定义
    const columns = [
      { label: 'Name', width: 100 },
      { label: 'Brand', width: 70 },
      { label: 'Model', width: 70 },
      { label: 'Purchase Date', width: 75 },
      { label: 'Price', width: 55 },
      { label: 'Channel', width: 70 },
      { label: 'Resale', width: 55 },
      { label: 'Status', width: 60 },
      { label: 'Category', width: 65 },
      { label: 'Daily Cost', width: 55 },
      { label: 'Warranty', width: 75 },
    ];

    const tableLeft = doc.page.margins.left;
    const rowHeight = 18;

    // 绘制表头
    let y = doc.y;
    doc.font(fontBold).fontSize(7);

    // 表头背景
    doc.rect(tableLeft, y, columns.reduce((s, c) => s + c.width, 0), rowHeight).fill('#e8e4dc');
    doc.fillColor('#333333');

    let x = tableLeft;
    for (const col of columns) {
      doc.text(col.label, x + 3, y + 4, { width: col.width - 6, ellipsis: true });
      x += col.width;
    }

    y += rowHeight;

    // 绘制数据行
    doc.font(font).fontSize(7);

    for (let i = 0; i < items.length; i++) {
      // 检查是否需要换页
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;

        // 重绘表头
        doc.font(fontBold).fontSize(7);
        doc.rect(tableLeft, y, columns.reduce((s, c) => s + c.width, 0), rowHeight).fill('#e8e4dc');
        doc.fillColor('#333333');

        let hx = tableLeft;
        for (const col of columns) {
          doc.text(col.label, hx + 3, y + 4, { width: col.width - 6, ellipsis: true });
          hx += col.width;
        }
        y += rowHeight;
        doc.font(font).fontSize(7);
      }

      const item = items[i];
      const price = toNumber(item.purchasePrice);
      const resaleRaw = item.resalePrice;
      const dailyCost = calcDailyCost(price, item.purchaseDate);

      // 交替行背景色
      if (i % 2 === 0) {
        doc.rect(tableLeft, y, columns.reduce((s, c) => s + c.width, 0), rowHeight).fill('#f9f8f5');
        doc.fillColor('#333333');
      }

      const rowData = [
        item.name,
        item.brand || '-',
        item.model || '-',
        formatDate(item.purchaseDate),
        price.toFixed(2),
        item.purchaseChannel || '-',
        resaleRaw != null ? toNumber(resaleRaw).toFixed(2) : '-',
        STATUS_MAP[item.status] || item.status,
        item.category?.name || '-',
        dailyCost.toFixed(2),
        formatDate(item.warrantyDate),
      ];

      x = tableLeft;
      for (let j = 0; j < columns.length; j++) {
        doc.text(String(rowData[j]), x + 3, y + 4, {
          width: columns[j].width - 6,
          ellipsis: true,
        });
        x += columns[j].width;
      }

      y += rowHeight;
    }

    // 底部分隔线
    doc.moveTo(tableLeft, y).lineTo(tableLeft + columns.reduce((s, c) => s + c.width, 0), y).stroke('#cccccc');

    doc.end();
  });
}
