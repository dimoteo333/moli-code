CC      = gcc
CFLAGS  = -Wall -Wextra -Wpedantic -std=c11 -g
TARGET  = bank
SRCS    = main.c bank.c
OBJS    = $(SRCS:.c=.o)

.PHONY: all clean run test

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^

%.o: %.c bank.h
	$(CC) $(CFLAGS) -c -o $@ $<

run: $(TARGET)
	./$(TARGET) && mv $(TARGET) ./test-project/bank

clean:
	rm -f *.o $(TARGET)

test:
	$(CC) $(CFLAGS) -o test main.c bank.c
	./test
	rm -f $(OBJS) $(TARGET)
