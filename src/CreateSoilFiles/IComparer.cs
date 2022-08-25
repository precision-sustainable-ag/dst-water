using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace test_database_app
{
    public class MyCustomComparer : IComparer
        /** this is custom comparer to allow us to sort the grid X and Y values as single precision
         * 
         * */

    {

         int IComparer.Compare(object a, object b)
        {
            float n1=Convert.ToSingle(a);
            float n2 = Convert.ToSingle(b);
            int res=n2.CompareTo(n1);  // if n1 is first then the sort is decreasing
            
            return res;
        }
                


    }
}
