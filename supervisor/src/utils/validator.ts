import type { ValidationOptions, ValidatorConstraintInterface } from 'class-validator'
import { isEnum, isNumber, isSemVer, isString, registerDecorator, ValidatorConstraint } from 'class-validator'

@ValidatorConstraint({ async: true })
export class IsSemverOrDefaultConstraint implements ValidatorConstraintInterface {
  public validate (data: any): boolean {
    return isSemVer(data) || isNumber(data) || isEnum(data, [ 'default' ])
  }
}

@ValidatorConstraint({ async: true })
export class IsBooleanOrStringArrayConstraint implements ValidatorConstraintInterface {
  public validate (data: any): boolean {
    return data === false || data === 'false' || Array.isArray(data) && data.every((d) => isString(d))
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
  return (object: Record<string, any>, propertyName: string): void => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsBooleanOrStringArrayConstraint
    })
  }
}
