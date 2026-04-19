CC = clang
CFLAGS = -Wall -Wextra -O3 -std=c11
TARGET = dasp
SOURCES = main.c spna_engine.c ml_kem.c fips202.c sha256.c rng.c poly.c poly_sampling.c aes.c gf_math.c

all: $(TARGET)

$(TARGET): $(SOURCES)
	$(CC) $(CFLAGS) -o $@ $^

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
