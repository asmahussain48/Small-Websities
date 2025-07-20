public class Main{
    public static void main (String [] args){
        
        System.out.println("Hellow");
        
        int nums[] = {0,1,2,2,4,4,1};
        boolean check[] = {false, false, false, false, false, false, false };
        for(int i = 0; i<7; i++){
            if((nums[i] % 2) == 0){
                check[i] = true;
            }
        }
        // for(boolean i:check){
        //     System.out.println(i);
        // }
        // for(int j:nums){
        //     System.out.println(j);
        // }
        int finalNum = -1;
        for(int i = 0; i<7 ; i++){
            if(check[i]){
                int temp = nums[i];
                for(int j = 0; j<7; j++){
                    if(nums[j] == temp){
                        finalNum = nums[j]
                    }
                }
            }
        }
        System.out.println(finalNum);
    }
}
// }
// class Solution {
//     public int mostFrequentEven(int[] nums) {
//         int nums[] = {0,1,2,2,4,4,1};
//         boolean check[] = {false, false, false, false, false, false};
//         for(int i = 0; i<7; i++){
//             if((nums[i] % 2) == 0){
//                 check[i] = true;
//             }
//         }
//         for(boolean i:check){
//             System.out.println(i);
//         }
//         for(int j:nums){
//             System.out.println(j);
//         }
//     }
// }
