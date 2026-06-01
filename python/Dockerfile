FROM python:3.11-slim AS builder

WORKDIR /app
COPY python/requirements.txt python/build.py python/dasp.py ./
COPY wasm/ ./wasm/
RUN pip install --no-cache-dir -r requirements.txt
RUN python build.py

FROM python:3.11-slim
WORKDIR /app

COPY python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=builder /app/dist ./dist

ENTRYPOINT ["python", "dist/dasp.py"]
