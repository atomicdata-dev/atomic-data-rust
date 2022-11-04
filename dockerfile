FROM frolvlad/alpine-rust as builder
WORKDIR /app
COPY . .
RUN apk add --no-cache openssl
RUN apk add --no-cache openssl-dev
RUN cargo build --release --bin atomic-server

# We only need a small runtime for this step, but make sure glibc is installed
FROM frolvlad/alpine-glibc as runtime
COPY --chmod=0755 --from=builder /app/target/release/atomic-server /atomic-server-bin
ENV ATOMIC_STORE_PATH="/atomic-storage/db"
ENV ATOMIC_CONFIG_PATH="/atomic-storage/config.toml"
ENV ATOMIC_PORT="80"
ENV ATOMIC_PORT_HTTPS="433"
EXPOSE 80
EXPOSE 433
VOLUME /atomic-storage
ENTRYPOINT ["/atomic-server-bin"]
