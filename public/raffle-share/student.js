export const CLASS_YEARS=['2027','2028','2029','2030','2031'];
export const HOUSES=['Altruismo','Amistad','Isibindi','Rêveur'];
export function studentDetails(value={}) {
 const aliases={Alterismo:'Altruismo',Isabindi:'Isibindi',Cbindi:'Isibindi',Rever:'Rêveur'};
 const house=Object.hasOwn(aliases,value.house)?aliases[value.house]:value.house;
 return {classYear:CLASS_YEARS.includes(value.classYear)?value.classYear:'',house:HOUSES.includes(house)?house:''};
}
