CC = clang
CFLAGS = -Wall -Wextra -O3 -std=c11 -fPIC
TARGET = dasp
LIB_TARGET = dspna512.so
SOURCES = spna_engine.c ml_kem.c fips202.c sha512.c sha256.c rng.c poly.c poly_sampling.c gf_math.c
OBJECTS = $(SOURCES:.c=.o)

all: $(TARGET) $(LIB_TARGET)

$(TARGET): $(OBJECTS) main.o
	$(CC) $(CFLAGS) -o $@ $^

$(LIB_TARGET): $(OBJECTS)
	$(CC) $(CFLAGS) -shared -o $@ $^

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(TARGET) $(LIB_TARGET) *.o

.PHONY: all clean
