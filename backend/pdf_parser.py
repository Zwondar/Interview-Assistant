"""PDF 简历解析：使用 pdfplumber 逐页提取文本。"""

import io
import logging

import pdfplumber

# 静音 pdfminer.six 解析某些 PDF 字体表时刷屏的无害警告
# （如 "Could not get FontBBox from font descriptor..."），不影响文本提取
logging.getLogger("pdfminer").setLevel(logging.ERROR)


def extract_text_from_pdf(file_bytes: bytes) -> tuple[str, int]:
    """从 PDF 字节流提取文本。

    返回 (文本, 页数)。文本为各页拼接，页间以换行分隔。
    """
    texts: list[str] = []
    pages = 0
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        pages = len(pdf.pages)
        for page in pdf.pages:
            text = page.extract_text() or ""
            texts.append(text)
    full = "\n".join(t.strip() for t in texts if t.strip()).strip()
    return full, pages
