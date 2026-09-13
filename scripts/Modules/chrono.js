class chrono {
    constructor() {
        this.date = new Date()
    }
    get millis() {
        return ((new Date()).getTime() - this.date.getTime())
    }
}