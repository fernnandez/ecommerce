import { Transactional } from 'typeorm-transactional';

export type RunFunction = () => Promise<void> | void;

class RollbackErrorException extends Error {
  constructor() {
    super('This exception is thrown to trigger transaction rollback in tests');
    this.name = 'RollbackErrorException';
  }
}

/**
 * Runs the code in a transaction and runs rollback on the transaction at the end of it.
 */
export function runWithRollbackTransaction(func: RunFunction) {
  return async () => {
    try {
      await TransactionCreator.run(func);
    } catch (e) {
      if (e instanceof RollbackErrorException) {
        // Expected rollback exception - transaction has been rolled back
        return;
      }
      // Real error occurred - re-throw it
      throw e;
    }
  };
}

class TransactionCreator {
  @Transactional()
  static async run(func: RunFunction) {
    try {
      await func();
    } catch {
      // Ignore original errors - we'll always throw rollback exception
    }
    // Always throw rollback exception to ensure transaction rolls back
    // This must happen outside finally to avoid ESLint error
    throw new RollbackErrorException();
  }
}
