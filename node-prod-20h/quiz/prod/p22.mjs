// Q: Happy Eyeballs: thời gian chờ mỗi họ địa chỉ trước khi thử họ kế tiếp là bao nhiêu ms?
import net from 'node:net';
console.log(`autoSelectFamily=${net.getDefaultAutoSelectFamily()} attemptTimeout=${net.getDefaultAutoSelectFamilyAttemptTimeout()}`);
