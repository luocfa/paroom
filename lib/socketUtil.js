/**
 *
 * @param io
 */
var socketUtil = function (io) {

    this.emitToRoomAll = function (params) {
        io.sockets.in(params.room || 'papaRoom').emit(params.action, params.data);
    };
    this.emitBack = function (socket, params) {
        socket.emit(params.action, params.data);
    };
    this.emitToRoom = function (socket, params) {
        socket.broadcast.to(params.room || 'papaRoom').emit(params.action, params.data);
    };
    this.emitToPerson = function (params) {
        console.log(params);
        io.sockets.sockets[params.userId].emit(params.action, params.data);
    };

}

module.exports = socketUtil;