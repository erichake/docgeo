export class chrono {
    date: Date;

    constructor() {
        this.date = new Date();
    }

    get millis(): number {
        return new Date().getTime() - this.date.getTime();
    }
}
