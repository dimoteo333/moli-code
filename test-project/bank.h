#ifndef BANK_H
#define BANK_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define MAX_ACCOUNTS     100
#define MAX_NAME_LEN     64
#define MAX_TRANS_HISTORY 50
#define ACCOUNT_ID_LEN   12

typedef enum {
    TRANS_DEPOSIT = 0,
    TRANS_WITHDRAW,
    TRANS_TRANSFER_OUT,
    TRANS_TRANSFER_IN
} TransactionType;

typedef struct {
    TransactionType type;
    double          amount;
    char            counterpart[ACCOUNT_ID_LEN];
    time_t          timestamp;
} Transaction;

typedef struct {
    char        account_id[ACCOUNT_ID_LEN];
    char        owner_name[MAX_NAME_LEN];
    double      balance;
    int         is_active;
    Transaction history[MAX_TRANS_HISTORY];
    int         history_count;
} Account;

typedef struct {
    Account accounts[MAX_ACCOUNTS];
    int     count;
} Bank;

/* Bank lifecycle */
void   bank_init(Bank *bank);

/* Account management */
int    account_create(Bank *bank, const char *owner_name, double initial_balance);
Account *account_find(Bank *bank, const char *account_id);
void   account_print(const Account *acc);

/* Transactions */
int    account_deposit(Bank *bank, const char *account_id, double amount);
int    account_withdraw(Bank *bank, const char *account_id, double amount);
int    account_transfer(Bank *bank, const char *from_id, const char *to_id, double amount);

/* Reporting */
void   bank_print_all(const Bank *bank);
void   account_print_history(const Account *acc);

#endif /* BANK_H */
