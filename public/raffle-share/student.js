export const CLASS_YEARS=['2027','2028','2029','2030','2031'];
export const HOUSES=['Alterismo','Amistad','Isabindi','Rever'];
export function studentDetails(value={}) {
 return {classYear:CLASS_YEARS.includes(value.classYear)?value.classYear:'',house:HOUSES.includes(value.house)?value.house:''};
}
