export const CLASS_YEARS=['2027','2028','2029','2030','2031'];
export const HOUSES=['Alterismo','Amistad','Isibindi','Rever'];
export function studentDetails(value={}) {
 const house=['Isabindi','Cbindi'].includes(value.house)?'Isibindi':value.house;
 return {classYear:CLASS_YEARS.includes(value.classYear)?value.classYear:'',house:HOUSES.includes(house)?house:''};
}
