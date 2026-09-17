const lsTime = 0;
const idbTime = 0;
const idbData = [1,2];
const lsData = [1,2,3];

if (idbData && lsData) {
  if (idbTime > lsTime && idbData.length > 0) {
    console.log('idb');
  } else {
    console.log('ls');
  }
}
