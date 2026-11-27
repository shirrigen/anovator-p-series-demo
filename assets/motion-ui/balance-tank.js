import {createLocalTank} from "../../balance-solver.js";
const send = createLocalTank((data, transfer) => postMessage(data,transfer));
self.onmessage = ({data}) => send(data);
