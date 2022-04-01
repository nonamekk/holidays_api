import { Injectable } from "@nestjs/common";

@Injectable()
export class ListingService {
    constructor() {}
  
    /**
     * Finds if the given list contain target value
     * @param list where you want to find
     * @param value what you want to find
     * @returns 
     */
    doesListContainValue(list: any[], value: any): boolean {
        if (list != null)
        if (list.length != 0) {
            for (let i=0; i<list.length; i++) {
                if (list[i] == value) {
                    return true;
                }
            }
        }
        return false;
    }
}
