#include "bank.h"

/* -----------------------------------------------------------------------
 * Scenario helpers
 * --------------------------------------------------------------------- */

static void separator(const char *title)
{
    printf("\n");
    printf("========================================================\n");
    printf("  %s\n", title);
    printf("========================================================\n");
}

/* -----------------------------------------------------------------------
 * Scenario 1 – Basic deposit, withdrawal, transfer (happy path)
 * --------------------------------------------------------------------- */
static void scenario_basic(Bank *bank)
{
    separator("Scenario 1: Basic operations");

    account_create(bank, "Alice",   1000.00);
    account_create(bank, "Bob",      500.00);
    account_create(bank, "Charlie",    0.00);

    bank_print_all(bank);

    /* Alice deposits */
    account_deposit(bank, "ACC00000001", 200.00);

    /* Bob withdraws */
    account_withdraw(bank, "ACC00000002", 100.00);

    /* Alice transfers to Charlie */
    account_transfer(bank, "ACC00000001", "ACC00000003", 300.00);

    bank_print_all(bank);

    account_print_history(account_find(bank, "ACC00000001"));
    account_print_history(account_find(bank, "ACC00000003"));
}

/* -----------------------------------------------------------------------
 * Scenario 2 – Edge cases that should be rejected
 * --------------------------------------------------------------------- */
static void scenario_edge_cases(Bank *bank)
{
    separator("Scenario 2: Edge cases (expected errors)");

    /* Withdraw more than balance */
    printf(">> Over-withdrawal attempt:\n");
    account_withdraw(bank, "ACC00000002", 9999.00);

    /* Transfer to same account */
    printf("\n>> Same-account transfer attempt:\n");
    account_transfer(bank, "ACC00000001", "ACC00000001", 50.00);

    /* Transfer from non-existent account */
    printf("\n>> Non-existent source account:\n");
    account_transfer(bank, "ACC99999999", "ACC00000002", 50.00);

    /* Zero-amount withdrawal */
    printf("\n>> Zero-amount withdrawal:\n");
    account_withdraw(bank, "ACC00000001", 0.00);

    /* Negative deposit — BUG: this should fail but currently succeeds */
    printf("\n>> Negative deposit (BUG: not rejected):\n");
    account_deposit(bank, "ACC00000001", -500.00);
    printf("   Alice balance after -500 deposit: %.2f\n",
           account_find(bank, "ACC00000001")->balance);
}

/* -----------------------------------------------------------------------
 * Scenario 3 – Sequential transfers to check running balances
 * --------------------------------------------------------------------- */
static void scenario_chain_transfers(void)
{
    separator("Scenario 3: Chain transfers");

    Bank chain_bank;
    bank_init(&chain_bank);

    account_create(&chain_bank, "D",  2000.00);
    account_create(&chain_bank, "E",     0.00);
    account_create(&chain_bank, "F",     0.00);

    /* D -> E -> F chain */
    account_transfer(&chain_bank, "ACC00000001", "ACC00000002", 1000.00);
    account_transfer(&chain_bank, "ACC00000002", "ACC00000003",  500.00);
    account_transfer(&chain_bank, "ACC00000003", "ACC00000001",  200.00);

    bank_print_all(&chain_bank);

    /* Expected final balances:
     *   D: 2000 - 1000 + 200 = 1200
     *   E: 0    + 1000 - 500 =  500
     *   F: 0    +  500 - 200 =  300
     */
    double d = account_find(&chain_bank, "ACC00000001")->balance;
    double e = account_find(&chain_bank, "ACC00000002")->balance;
    double f = account_find(&chain_bank, "ACC00000003")->balance;

    printf("Verification:\n");
    printf("  D expected 1200.00, got %.2f  %s\n", d, d == 1200.0 ? "PASS" : "FAIL");
    printf("  E expected  500.00, got %.2f  %s\n", e, e ==  500.0 ? "PASS" : "FAIL");
    printf("  F expected  300.00, got %.2f  %s\n", f, f ==  300.0 ? "PASS" : "FAIL");
    printf("  Total conservation: %.2f (expect 2000.00)  %s\n",
           d + e + f, (d + e + f == 2000.0) ? "PASS" : "FAIL");
}

/* -----------------------------------------------------------------------
 * Scenario 4 – Stress test: many small transfers
 * --------------------------------------------------------------------- */
static void scenario_stress(void)
{
    separator("Scenario 4: Stress test (1000 transfers)");

    Bank stress_bank;
    bank_init(&stress_bank);

    account_create(&stress_bank, "Ping", 100000.00);
    account_create(&stress_bank, "Pong",      0.00);

    for (int i = 0; i < 1000; i++) {
        /* Ping -> Pong 10, Pong -> Ping 10 alternately */
        if (i % 2 == 0)
            account_transfer(&stress_bank, "ACC00000001", "ACC00000002", 10.00);
        else
            account_transfer(&stress_bank, "ACC00000002", "ACC00000001", 10.00);
    }

    double ping = account_find(&stress_bank, "ACC00000001")->balance;
    double pong = account_find(&stress_bank, "ACC00000002")->balance;

    printf("\nAfter 1000 alternating transfers of 10.00:\n");
    printf("  Ping: %.2f\n", ping);
    printf("  Pong: %.2f\n", pong);
    printf("  Total: %.2f (expect 100000.00)  %s\n",
           ping + pong,
           (ping + pong == 100000.0) ? "PASS" : "FAIL");
}

/* -----------------------------------------------------------------------
 * main
 * --------------------------------------------------------------------- */
int main(void)
{
    Bank bank;
    bank_init(&bank);

    scenario_basic(&bank);
    scenario_edge_cases(&bank);
    scenario_chain_transfers();
    scenario_stress();

    printf("\nAll scenarios completed.\n");
    return 0;
}
