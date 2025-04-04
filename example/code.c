#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    int *ptr = NULL;  
    int value;

    if (argc < 2) {
        printf("No argument provided.\n");
        printf("Syntax: %s <number>\n", argv[0]);
        exit(0);
    }
    
    value = atoi(argv[1]);

    if (value > 10) {
        ptr = (int*)malloc(sizeof(int));
        *ptr = value; 
    }
    
    printf("The value at ptr is: %d\n", *ptr);
    
    if (ptr != NULL) {
        free(ptr);
    }
    
    return 0;
}