export default class Utils {
  static getRandomEnumValue<T extends Record<string, string | number>>(
    enumObj: T
  ): T[keyof T] {
    const keys = Object.keys(enumObj).filter(
      key => isNaN(Number(key))
    ) as (keyof T)[];
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    return enumObj[randomKey];
  }  
}