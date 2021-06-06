import { isEnum, isSemVer, registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator'

@ValidatorConstraint({ async: true })
export class IsSemverOrDefaultConstraint implements ValidatorConstraintInterface {
  public validate (data: any): boolean {
    return isSemVer(data) || isEnum(data, [ 'default' ])
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
