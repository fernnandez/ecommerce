export class Identification {
  private readonly value: string;

  constructor(value: string) {
    this.value = this.normalize(value);
    this.validate(this.value);
  }

  private normalize(cpf: string): string {
    return cpf.replace(/[^\d]/g, '');
  }

  private validate(cpf: string): void {
    if (!cpf || cpf.length === 0) {
      throw new Error('CPF não pode ser vazio');
    }

    if (cpf.length !== 11) {
      throw new Error('CPF deve ter 11 dígitos');
    }

    if (/^(\d)\1{10}$/.test(cpf)) {
      throw new Error('CPF inválido: não pode ter todos os dígitos iguais');
    }

    if (!this.isValidCpf(cpf)) {
      throw new Error('CPF inválido: dígitos verificadores incorretos');
    }
  }

  private isValidCpf(cpf: string): boolean {
    let sum = 0;
    let remainder: number;

    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;

    return true;
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  equals(other: Identification): boolean {
    return this.value === other.value;
  }

  static from(value: string): Identification {
    return new Identification(value);
  }
}
