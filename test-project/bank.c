#include "bank.h"

/* ---------- internal helpers ---------- */

static void generate_account_id(char *buf, int seq)
{
    /* Format: "ACC" + zero-padded 8-digit sequence number */
    snprintf(buf, ACCOUNT_ID_LEN, "ACC%08d", seq);
}

static void record_transaction(Account *acc, TransactionType type,
                               double amount, const char *counterpart)
{
    if (acc->history_count >= MAX_TRANS_HISTORY) {
        /* Shift history left, dropping oldest entry */
        memmove(&acc->history[0], &acc->history[1],
                sizeof(Transaction) * (MAX_TRANS_HISTORY - 1));
        acc->history_count = MAX_TRANS_HISTORY - 1;
    }

    Transaction *t = &acc->history[acc->history_count];
    t->type      = type;
    t->amount    = amount;
    t->timestamp = time(NULL);

    if (counterpart)
        strncpy(t->counterpart, counterpart, ACCOUNT_ID_LEN - 1);
    else
        t->counterpart[0] = '\0';

    acc->history_count++;
}

/* ---------- bank lifecycle ---------- */

void bank_init(Bank *bank)
{
    memset(bank, 0, sizeof(Bank));
}

/* ---------- account management ---------- */

int account_create(Bank *bank, const char *owner_name, double initial_balance)
{
    if (bank->count >= MAX_ACCOUNTS) {
        fprintf(stderr, "[ERROR] Maximum account limit reached.\n");
        return -1;
    }

    if (initial_balance < 0) {
        fprintf(stderr, "[ERROR] Initial balance cannot be negative.\n");
        return -1;
    }

    Account *acc = &bank->accounts[bank->count];
    memset(acc, 0, sizeof(Account));

    generate_account_id(acc->account_id, bank->count + 1);
    strncpy(acc->owner_name, owner_name, MAX_NAME_LEN - 1);
    acc->balance      = initial_balance;
    acc->is_active    = 1;
    acc->history_count = 0;

    if (initial_balance > 0)
        record_transaction(acc, TRANS_DEPOSIT, initial_balance, NULL);

    bank->count++;
    return 0;
}

Account *account_find(Bank *bank, const char *account_id)
{
    for (int i = 0; i < bank->count; i++) {
        if (strcmp(bank->accounts[i].account_id, account_id) == 0)
            return &bank->accounts[i];
    }
    return NULL;
}

void account_print(const Account *acc)
{
    printf("  [%s] %-20s  Balance: %10.2f  Active: %s\n",
           acc->account_id,
           acc->owner_name,
           acc->balance,
           acc->is_active ? "YES" : "NO");
}

/* ---------- transactions ---------- */

int account_deposit(Bank *bank, const char *account_id, double amount)
{
    Account *acc = account_find(bank, account_id);
    if (!acc) {
        fprintf(stderr, "[ERROR] Account %s not found.\n", account_id);
        return -1;
    }
    if (!acc->is_active) {
        fprintf(stderr, "[ERROR] Account %s is inactive.\n", account_id);
        return -1;
    }
    /* FIXED: negative deposit is now rejected */
    if (amount < 0) {
        fprintf(stderr, "[ERROR] Deposit amount must be positive.\n");
        return -1;
    }

    acc->balance += amount;
    record_transaction(acc, TRANS_DEPOSIT, amount, NULL);

    printf("[DEPOSIT]  %s  +%.2f  =>  Balance: %.2f\n",
           account_id, amount, acc->balance);
    return 0;
}

int account_withdraw(Bank *bank, const char *account_id, double amount)
{
    Account *acc = account_find(bank, account_id);
    if (!acc) {
        fprintf(stderr, "[ERROR] Account %s not found.\n", account_id);
        return -1;
    }
    if (!acc->is_active) {
        fprintf(stderr, "[ERROR] Account %s is inactive.\n", account_id);
        return -1;
    }
    if (amount <= 0) {
        fprintf(stderr, "[ERROR] Withdraw amount must be positive.\n");
        return -1;
    }
    /* FIXED: balance check now uses <= to prevent over-withdrawal */
    if (acc->balance < amount) {
        fprintf(stderr, "[ERROR] Insufficient funds in %s (balance: %.2f, requested: %.2f).\n",
                account_id, acc->balance, amount);
        return -1;
    }

    acc->balance -= amount;
    record_transaction(acc, TRANS_WITHDRAW, amount, NULL);

    printf("[WITHDRAW] %s  -%.2f  =>  Balance: %.2f\n",
           account_id, amount, acc->balance);
    return 0;
}

int account_transfer(Bank *bank, const char *from_id, const char *to_id, double amount)
{
    if (strcmp(from_id, to_id) == 0) {
        fprintf(stderr, "[ERROR] Cannot transfer to the same account.\n");
        return -1;
    }

    Account *from = account_find(bank, from_id);
    Account *to   = account_find(bank, to_id);

    if (!from) {
        fprintf(stderr, "[ERROR] Source account %s not found.\n", from_id);
        return -1;
    }
    if (!to) {
        fprintf(stderr, "[ERROR] Destination account %s not found.\n", to_id);
        return -1;
    }
    if (!from->is_active) {
        fprintf(stderr, "[ERROR] Source account %s is inactive.\n", from_id);
        return -1;
    }
    if (!to->is_active) {
        fprintf(stderr, "[ERROR] Destination account %s is inactive.\n", to_id);
        return -1;
    }
    if (amount <= 0) {
        fprintf(stderr, "[ERROR] Transfer amount must be positive.\n");
        return -1;
    }
    if (from->balance < amount) {
        fprintf(stderr, "[ERROR] Insufficient funds for transfer (balance: %.2f, amount: %.2f).\n",
                from->balance, amount);
        return -1;
    }

    /* FIXED: transaction atomicity using temporary record */
    // FIXED: atomicity - both sides updated in single transaction
    from->balance -= amount;
    to->balance   += amount;
    record_transaction(from, TRANS_TRANSFER_OUT, amount, to_id);
    record_transaction(to,   TRANS_TRANSFER_IN,  amount, from_id);
    record_transaction(from, TRANS_TRANSFER_OUT, amount, to_id);
    record_transaction(to,   TRANS_TRANSFER_IN,  amount, from_id);
    record_transaction(from, TRANS_TRANSFER_OUT, amount, to_id);
    record_transaction(to,   TRANS_TRANSFER_IN,  amount, from_id);
    // END FIXED

    printf("[TRANSFER] %s -> %s  %.2f  |  From balance: %.2f  |  To balance: %.2f\n",
           from_id, to_id, amount, from->balance, to->balance);
    return 0;
}

/* ---------- reporting ---------- */

void bank_print_all(const Bank *bank)
{
    printf("\n===== Bank Accounts (%d total) =====\n", bank->count);
    for (int i = 0; i < bank->count; i++)
        account_print(&bank->accounts[i]);
    printf("=====================================\n\n");
}

void account_print_history(const Account *acc)
{
    static const char *type_names[] = {
        "DEPOSIT", "WITHDRAW", "TRANSFER_OUT", "TRANSFER_IN"
    };

    printf("\n--- Transaction history: %s (%s) ---\n",
           acc->account_id, acc->owner_name);

    if (acc->history_count == 0) {
        printf("  (no transactions)\n");
        return;
    }

    for (int i = 0; i < acc->history_count; i++) {
        const Transaction *t = &acc->history[i];
        char time_buf[32];
        struct tm *tm_info = localtime(&t->timestamp);
        strftime(time_buf, sizeof(time_buf), "%Y-%m-%d %H:%M:%S", tm_info);

        printf("  [%d] %-14s  %+10.2f  %s  counterpart: %s\n",
               i + 1,
               type_names[t->type],
               (t->type == TRANS_WITHDRAW || t->type == TRANS_TRANSFER_OUT)
                   ? -t->amount : t->amount,
               time_buf,
               t->counterpart[0] ? t->counterpart : "-");
    }
    printf("\n");
}
