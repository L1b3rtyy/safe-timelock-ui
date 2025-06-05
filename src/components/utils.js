function shorten(str, length) {
  return str && (str.length < 2*length + 5 ? str : str.substring(0,length+2) + "..." + str.substring(str.length-length,str.length));
}
export function addressDisplay(address) {
  return shorten(address, 8);
}
export function truncate(str, length) {
  return str && (str.length < length + 3 ? str : str.substring(0,length) + "...");
}