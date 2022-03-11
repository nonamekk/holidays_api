
export class ErrorService {
    static addError(value, error) {
        if (value == undefined) {
            return error;               
        } else if (typeof value ==='string') {
            return [value, error]
        } else if (typeof value === 'object') {
            return value.push(error)
        } else {
            throw "Type set for error value is not operatable";
        }
    }
    
}