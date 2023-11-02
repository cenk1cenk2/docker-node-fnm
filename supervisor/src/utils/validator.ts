import type { ValidationArguments, ValidationOptions, ValidatorConstraintInterface } from 'class-validator'
import { isEnum, isNumber, isSemVer, isString, registerDecorator, ValidatorConstraint } from 'class-validator'

@ValidatorConstraint()
export class IsSemverOrDefaultConstraint implements ValidatorConstraintInterface {
  public validate (value: unknown): boolean {
    return isSemVer(value) || isNumber(value) || isEnum(value, [ 'default' ])
  }

  public defaultMessage (params: ValidationArguments): string {
    return `Property "${params.property}" should be "default" or a valid semantic-version.`
  }
}

@ValidatorConstraint()
export class IsBooleanOrStringArrayConstraint implements ValidatorConstraintInterface {
  public validate (value: unknown): boolean {
    return value === false || value === 'false' || Array.isArray(value) && value.every((d) => isString(d))
  }

  public defaultMessage (params: ValidationArguments): string {
    return `Property "${params.property}" should be either boolean or a string array.`
  }
}

export function IsSemverOrDefault (validationOptions?: ValidationOptions) {
  return (object: Record<string, any>, propertyName: string): void => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSemverOrDefaultConstraint
    })
  }
}

export function IsFalseOrStringArray (validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsBooleanOrStringArrayConstraint
    })
  }
}
