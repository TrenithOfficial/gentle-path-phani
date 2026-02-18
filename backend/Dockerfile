# ---------- build stage ----------
FROM golang:1.25-alpine AS build

WORKDIR /app

RUN apk add --no-cache git ca-certificates && update-ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o server .

# ---------- run stage ----------
FROM gcr.io/distroless/base-debian12

WORKDIR /app
COPY --from=build /app/server /app/server

EXPOSE 8080

USER nonroot:nonroot
ENTRYPOINT ["/app/server"]
