

public class Main {
    public static void main(String[] args) {
        // Step 1: Initialize 5 students
        Student[] students = new Student[5];
        students[0] = new Student(1, "John", 20);
        students[1] = new Student(2, "Mary", 21);
        students[2] = new Student(3, "Krish", 19);
        students[3] = new Student(4, "Sara", 22);
        students[4] = new Student(5, "David", 23);

        // Step 2: Remove student at index 4
        System.out.println("Remove element at 4");
        students = removeElement(4, students);
        printArray("Remove", students);

        // Step 3: Add new student
        System.out.println("Add new student rollNumber :6, Name : shally, Age: 3");
        Student newStudent = new Student(6, "Shally", 3);
        students = addElement(newStudent, students);
        printArray("Add", students);

        // Optional: Update student at index 0
        updateElement(0, students);
        printArray("Update", students);
    }

    public static Student[] removeElement(int indexToDelete, Student[] originalArray) {
        Student[] newArray = new Student[originalArray.length - 1];
        int j = 0;
        for (int i = 0; i < originalArray.length; i++) {
            if (i != indexToDelete) {
                newArray[j++] = originalArray[i];
            }
        }
        return newArray;
    }

    public static Student[] addElement(Student newStudent, Student[] originalArray) {
        Student[] newArray = new Student[originalArray.length + 1];
        for (int i = 0; i < originalArray.length; i++) {
            newArray[i] = originalArray[i];
        }
        newArray[newArray.length - 1] = newStudent;
        return newArray;
    }

    public static void updateElement(int indexToUpdate, Student[] originalArray) {
        if (indexToUpdate >= 0 && indexToUpdate < originalArray.length) {
            Student s = originalArray[indexToUpdate];
            s.setName("UpdatedName");
            s.setAge(99);
            s.setRollNumber(100);
        }
    }

    public static void printArray(String message, Student[] students) {
        System.out.println("Operation:" + message);
        for (Student s : students) {
            System.out.println("Student Name : " + s.getName());
        }
    }
}
