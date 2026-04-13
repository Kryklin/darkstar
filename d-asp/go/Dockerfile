# Build stage
FROM golang:1.21-alpine as builder
WORKDIR /app
COPY . .
RUN go build -o darkstar-crypt-go main.go

# Runtime stage
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/darkstar-crypt-go .
ENTRYPOINT ["./darkstar-crypt-go"]
