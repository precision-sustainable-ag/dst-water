/*! @file
   Contains utilities for MAIZSIM to create soil files and grid
 * 
*/


using System;
using System.Collections.Generic;
using System.Collections;
using System.Linq;
using System.Text;
using System.IO;
using System.Data;



namespace test_database_app
{
    /* ! \class Utilities
     * \brief class to contain utilities for managing input and output of files
     * \par Usage
       - Use <b>ParseRunFile</b> to read the runfile and look for the grid and soil file names
       - Use <b>ParseGridFile</b> to find and input grid information (for modifying a grid)
       - Use <b>WriteGridFile</b> to write the grid information to a file
       - Use <b>WriteNodalFile</b> to write the node information to a file
       - Use <b>CalcYNodes</b> to output and arraylist of nodes in the Y direction
       - Use <b>WriteToGridGenFile</b> to write the grid information for the mesh generation program to a file
       - Use <b>WriteParamToSoilFile</b> to write soil hydraulic parameters to a file that were read from the input database (rather than generated)
     * 
     * */
    class Utilities
    {
        public Utilities()
        {
        }

        public inFiles CreateGridFiles(string GF)
        {
            //The purpose of this procedure is to create the grid file names using GF as the stub
            // and open the files for output
            inFiles myFiles = new inFiles();

            myFiles.NodeFile = GF + ".nod";
            myFiles.GridFileForOutput = GF + ".grd";
            myFiles.GridFileRoot = GF;
         

            return myFiles;


        }

        public DataSet ParseGridFile(string GridFile)
        {
            //This procedure reads the Grid file and extracts the grid 
            // the procedure creates a table to hold the grid data and fills it with data from the file.
            StreamReader sr = new StreamReader(new FileStream(GridFile, FileMode.Open, FileAccess.Read));
            int node, i, element;
            char[] charSeparators = new char[] { ' ' };
            DataSet dsGrid = new DataSet("Grid");
            DataTable dtNode = new DataTable("Node");
            DataTable dtElem4Grid = new DataTable("Elem");
            DataRow dr;
           
            String inString;
            String [] strFields;
            // set up the DataTable to hold the grid information
            dtNode.Columns.Add(new DataColumn("Node", typeof(Int32)));
            dtNode.Columns.Add(new DataColumn("X", typeof(double)));
            dtNode.Columns.Add(new DataColumn("Y", typeof(double)));
            dtNode.Columns.Add(new DataColumn("MatNum", typeof(Int32)));
            dtNode.Columns.Add(new DataColumn("NodeArea", typeof(double)));
            dtNode.Columns.Add(new DataColumn("RTWT0", typeof(double))); //WSun RTWT0 represents relative number of root density (no relationship with any physical) 
            dtNode.Columns.Add(new DataColumn("RTWT1", typeof(double)));  // WSun RTWT1 represents the multiplication of RTWT0 and node area
            dtNode.Columns.Add(new DataColumn("RTWT", typeof(double))); // WSun RTWT represents the root density which read by SPUDSIM


            dtElem4Grid.Columns.Add(new DataColumn("Element", typeof(Int32)));
            dtElem4Grid.Columns.Add(new DataColumn("TL", typeof(Int32)));
            dtElem4Grid.Columns.Add(new DataColumn("BL", typeof(Int32)));
            dtElem4Grid.Columns.Add(new DataColumn("BR", typeof(Int32)));
            dtElem4Grid.Columns.Add(new DataColumn("TR", typeof(Int32)));
            dtElem4Grid.Columns.Add(new DataColumn("MatNum", typeof(Int32)));


            

           
            // read headers
            sr.ReadLine();
            sr.ReadLine();

            // don't really need inString. As done below one can use the Split method
            // with Readline()
            inString = sr.ReadLine();
            strFields = inString.Split(charSeparators,StringSplitOptions.RemoveEmptyEntries);
            // read header to get node numbers 
            node=Convert.ToInt32(strFields[1]); //note that strFields is a string
            element = Convert.ToInt32(strFields[2]);
            sr.ReadLine();
            for (i=1;i<=node;i++)
            {
                strFields=sr.ReadLine().Split(charSeparators,StringSplitOptions.RemoveEmptyEntries);
                //note that dr is defined as a datarow. You first put the data into a datarow item by item
                // use the [] structure to index them
                dr=dtNode.NewRow();
                dr[0]=Convert.ToInt32(strFields[0]);
                dr[1]=Convert.ToDouble(strFields[1]);
                dr[2]=Convert.ToDouble(strFields[2]);
                dr[3]=Convert.ToDouble(strFields[3]);
                

                dtNode.Rows.Add(dr);
            }
            dsGrid.Tables.Add(dtNode);
            sr.ReadLine(); // read two text lines
            sr.ReadLine();
            for (i = 1; i <= element; i++)
            {
                strFields = sr.ReadLine().Split(charSeparators, StringSplitOptions.RemoveEmptyEntries);
                //note that dr is defined as a datarow. You first put the data into a datarow item by item
                // use the [] structure to index them
                dr = dtElem4Grid.NewRow();
                dr[0] = Convert.ToInt32(strFields[0]);
                dr[1] = Convert.ToInt32(strFields[1]);
                dr[2] = Convert.ToInt32(strFields[2]);
                dr[3] = Convert.ToInt32(strFields[3]);
                dr[4] = Convert.ToInt32(strFields[4]);
                dr[5] = Convert.ToInt32(strFields[5]);
                dtElem4Grid.Rows.Add(dr);
            }
            dsGrid.Tables.Add(dtElem4Grid);
            sr.Close();
            return dsGrid;

        }
        


        public void WriteGridFile(DataSet dsGrid, String NewGridFile, String OldGridFile, int MatNum, int BottomBC,
                     int GasBCTop, int GasBCBottom)
        {
            // this writes the grid file by taking items from the original file (template) and copying
            // to the new file. The grid data with the new material numbers come from the datatable. 
            int  i;
            char[] charSeparators = new char[] { ' ' };
            String[] strFields;
            String inString;
            DataTable OutNode =new DataTable();
            OutNode=dsGrid.Tables[0];
            DataTable OutElem =new DataTable();
            OutElem=dsGrid.Tables[1];
            StreamWriter srOut = new StreamWriter(new FileStream(NewGridFile, FileMode.Create, FileAccess.Write));
            StreamReader srIn = new StreamReader(new FileStream(OldGridFile, FileMode.Open, FileAccess.Read));
            inString=srIn.ReadLine();
            srOut.WriteLine(inString);
          
            inString=srIn.ReadLine();
            srOut.WriteLine(inString);

            inString = srIn.ReadLine(); // line with counts 
            strFields = inString.Split(charSeparators, StringSplitOptions.RemoveEmptyEntries);
            strFields[5]=MatNum.ToString();
            for (i = 0; i < strFields.Length; i++)
            {
                srOut.Write("  {0}   ",strFields[i]);
            }
            srOut.WriteLine();
            inString = srIn.ReadLine();
            srOut.WriteLine(inString);

            foreach (DataRow Row in OutNode.Rows)
            {
                foreach (DataColumn Column in OutNode.Columns)
                {
                    srOut.Write("\t{0}", Row[Column]);
                    
                }
                srOut.WriteLine();
                srIn.ReadLine();
              //  srOut.WriteLine();
            }

            // now read remainder of file from template and transfer to new file
            // first have To find the correct location in the template file
            //ToDo - modify this for elements 
            inString=srIn.ReadLine();
            srOut.WriteLine(inString);
            inString = srIn.ReadLine();
            srOut.WriteLine(inString);
            
            foreach (DataRow Row in OutElem.Rows)
            {
                foreach (DataColumn Column in OutElem.Columns)
                {
                    srOut.Write("\t{0}", Row[Column]);

                }
                srOut.WriteLine();
                srIn.ReadLine();
                //  srOut.WriteLine();
            }
        
            
            do
            {
                inString = srIn.ReadLine();
                srOut.WriteLine(inString);
             } while (!srIn.EndOfStream);
            srOut.Close();
            srIn.Close();

        } //End WriteGridFile
        public void WriteNodalFile(String NodalFileName, DataTable dtNodal, DataTable dtLayers)
        {
            StreamWriter srOut = new StreamWriter(new FileStream(NodalFileName, FileMode.Create, FileAccess.Write));
            srOut.WriteLine(" ***************** NODAL INFORMATION for MAIZSIM *******************************************************");
            foreach (DataColumn column in dtNodal.Columns)
            {
                srOut.Write("\t{0}", column.ColumnName);
            }
            srOut.WriteLine();
            foreach (DataRow Row in dtNodal.Rows)
            {
                foreach (DataColumn Column in dtNodal.Columns)
                {
                    if (Column.ColumnName == "Node")
                    {
                        srOut.Write("\t{0}", Row[Column]);
                    }

                   else if (Column.ColumnName == "RTWT")
                    {
                        srOut.Write("\t{0:0.000000}", Row[Column]);
                    }
                   

                    else srOut.Write("\t{0:0.00}", Row[Column]);

                }
                srOut.WriteLine();
            }
            srOut.Close();

        }
        public DataTable CreateNodalTable(DataTable dtGrid)
      
        {
            DataTable dtNodal=new DataTable();
            DataRow dr;
            int i,j;
            dtNodal.Columns.Add(new DataColumn("Node", typeof(Int32)));
            dtNodal.Columns.Add(new DataColumn("Nh", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("Ch", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("Nm", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("Nl", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("Cl", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("Cm", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("NH4", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("NO3", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("Tmpr", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("hNew", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("CO2", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("O2", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("RTWT", typeof(double)));
            dtNodal.Columns.Add(new DataColumn("MatNum",typeof(double)));
            dtNodal.Columns.Add(new DataColumn("Y", typeof(double))); //needed to calculate slope later


            int nodes = dtGrid.Rows.Count;
            // create a table with zeroes as elements. Table has same number of rows as the grid table
            for (i = 0; i < nodes; i++)
            {
                dr = dtNodal.NewRow();
                dr[0]=i+1;
                for (j=1;j<dtNodal.Columns.Count;j++)
                {
                    dr[j]=0;
                }
                DataRow r=dtGrid.Rows[i];
                dr["RTWT"] = r["RTWT"];
                dr["MatNum"]=r["MatNum"];
                dr["Y"] = r["Y"];
                dtNodal.Rows.Add(dr);
            }
            return dtNodal;
        } // end datatable method

        public ArrayList CaclYNodes(double IntervalRatio, double Length, double StartPoint, double FirstInterval, int Direction)
        //This routine returns a vector of values (Segments)for the increments along a line from the starting point to the Length
        // The first column is node, the second is the Y value. 
        // This method uses a geometric progression where IntervalRatio is the ratio between two depths
        // direction is 1 for up to down and -1 for down to up
        // Returns ArrayList Segments
        {
            int  i;
            float Distance;
            int NumberOfNodes;
            double dNumberOfNodes; //double version for first approximation
            double CalculatedLength=0.0;  //keeps track of the summed length of the segments to compare with
                                      //the planned length (Length)
            double Difference;
            
            ArrayList Segment = new ArrayList();
            double aux1, aux2; //holding variables
            dNumberOfNodes = 1 - Length / FirstInterval * (1 - IntervalRatio);
            dNumberOfNodes=Math.Log(dNumberOfNodes)/Math.Log(IntervalRatio)+1;
            NumberOfNodes = Convert.ToInt16(dNumberOfNodes);

            CalculatedLength = FirstInterval;
            Segment.Add(StartPoint);
            Segment.Add(StartPoint-FirstInterval*Direction); // those going down will decrease in value
                                                             // those going up increase; in value
            aux1 = FirstInterval;
            // start at the 3rd node (i=2)
            for (i = 2; i < NumberOfNodes; i++)
            {
               if (Direction ==1)
                {
                    aux2 = FirstInterval * Math.Pow(IntervalRatio, i-1);
                    aux1+= FirstInterval * Math.Pow(IntervalRatio, i-1);
                    Distance = (float)StartPoint - (float)aux1;
                    CalculatedLength += FirstInterval * Math.Pow(IntervalRatio, i - 1);
                    Difference = CalculatedLength - Length;
                    //if we overshot or undershot the distance we have to correct the last length
                    if (i == NumberOfNodes - 1)
                    {
                        if (Math.Abs((float)Difference) > 0)
                        {
                            Distance = Distance + (float)Difference;
                        }
                    }

                    Segment.Add(Distance);   //if you round up on number of nodes. you will go past the length. This
                                             //can be calculated as (dNumberOfNodes-NumberOfNodes)
                }

               if (Direction == -1)
               {
                   aux1+= FirstInterval * Math.Pow(IntervalRatio, i-1);
                   Distance = (float)StartPoint + (float)(aux1);
                   CalculatedLength += FirstInterval * Math.Pow(IntervalRatio, i - 1);
                   Difference = CalculatedLength - Length;

                   if (i == NumberOfNodes - 1)
                   {
                       if (Math.Abs((float)Difference) > 0)
                       {
                           Distance = Distance - (float)Difference;
                       }
                   }
                   Segment.Add(Distance);
               }
            }
            //if ((double)segment
            return Segment;
        }

        public List<double> CaclXNodes(double RowSpacing)
        //This routine returns a vector of values (Segments)for the increments along a line from the starting point to the Length
        // The first column is node, the second is the Y value. 
        // This method uses a geometric progression where IntervalRatio is the ratio between two depths
        // Calculates the nodes for the X dimension (across row). The only input it RowSpacing
        // parameters for interval, etc are hardcoded.
        // Returns ArrayList Segments
        {
            int i;
            float Distance;
            int NumberOfNodes;
            double dNumberOfNodes; //double version for first approximation
            double CalculatedLength = 0.0;  //keeps track of the summed length of the segments to compare with
                                            //the planned length (Length)
            double Difference;
            // double FirstInterval = .5, IntervalRatio = 1.28;
            double FirstInterval = .75, IntervalRatio = 1.4;  // WSun change the values to make the number of nodes in X direction become 7
            double Length = RowSpacing / 2, StartPoint=0;
            List<double> Segment = new List<double>();
            double aux1; //holding variables

            ////code starts here
            dNumberOfNodes = 1 - Length / FirstInterval * (1 - IntervalRatio);
            dNumberOfNodes = Math.Log(dNumberOfNodes) / Math.Log(IntervalRatio) + 1;
            NumberOfNodes = Convert.ToInt16(dNumberOfNodes);

            CalculatedLength = FirstInterval;
            Segment.Add(StartPoint);
            Segment.Add(StartPoint + FirstInterval); // x axis increases in value
            aux1 = FirstInterval;
            // start at the 3rd node (i=2)
            for (i = 2; i < NumberOfNodes; i++)
            {
                aux1 += FirstInterval * Math.Pow(IntervalRatio, i - 1);
                Distance = (float)StartPoint + (float)aux1;
                CalculatedLength += FirstInterval * Math.Pow(IntervalRatio, i - 1);
                Difference = Length-CalculatedLength;
                //if we overshot or undershot the distance we have to correct the last length
                if (i == NumberOfNodes-1)
                {
                    if ((float)Difference < 0)
                    {
                        Distance = Distance + (float)Difference;
                    }
                    if (Math.Abs((float)Difference) > 0)
                    {
                        Distance = (float)Length;
                    }
                }

                Segment.Add(Distance);   //if you round up on number of nodes. you will go past the length. This
                                         //can be calculated as (dNumberOfNodes-NumberOfNodes)
            }
            return Segment;
        }


        public void WriteToGridGenFile(string GridGenInput, ArrayList YSegment, List<double> xSegment, int BottomBC, int GasBCTop, int GasBCBottom)
        {
            //Writes to the GridGenFile which is used by the fortran program
            int i, j;
            StreamWriter srOut = new StreamWriter(new FileStream(GridGenInput, FileMode.Create, FileAccess.Write));
            srOut.WriteLine("IJ  E00  n00   NumNP  NumEl NMAt  BC  GasBCTop   GasBCBottom");
            //bandwidth is the size of the x array
            
            // calculate total number of y nodes
            int YnodeCount=0;
            for (i = 0; i < YSegment.Count; i++) 
            {
                ArrayList Seg = (ArrayList)YSegment[i];
                for (j = 0; j < Seg.Count; j++)
                {
                    YnodeCount++;
                }
            }
            srOut.WriteLine(" {0} 1   1  {1}   {2}  0  {3}   {4}   {5}", xSegment.Count(), xSegment.Count()*YnodeCount,
            (xSegment.Count()-1)*(YnodeCount-1), BottomBC, GasBCTop, GasBCBottom);


            srOut.WriteLine("x(j): ");
            for (i=0;i<xSegment.Count();i++)
            {
                srOut.Write(" {0} ", xSegment[i]);
            }

            srOut.WriteLine();
            srOut.WriteLine("y(i): 1->(NumNP-n00)/IJ+1");
            for (i = 0; i < YSegment.Count; i++) 
            {
                ArrayList Seg = (ArrayList)YSegment[i];
                for (j = 0; j < Seg.Count; j++)
                {
                    srOut.Write(" {0} ",Seg[j]); // for some reason when this is a float you don't need to cast. I am not sure why
                }
                srOut.WriteLine();

            }


            srOut.Close();
        }
        public void CreateSoilFile(DataTable dtLayer, string SoilFileName)
        {
            // writes the file with intput data for rosetta
            int matnum;
            StreamWriter srOut = new StreamWriter(new FileStream(SoilFileName, FileMode.Create, FileAccess.Write));
            srOut.WriteLine("  Matnum      sand     silt    clay     bd     om   TH33       TH1500 ");
            matnum = 1;
            foreach (DataRow row in dtLayer.Rows)
            {
                srOut.WriteLine(" {0:0}\t {1:0.000}\t {2:0.000}\t {3:0.000}\t {4:0.000}\t {5:0.000}\t {6:0.000}\t  {7:0.000}\t {8:3}",

                                   matnum, row["sand"], row["silt"], row["clay"],
                                    row["BD"], row["OM"], row["TH33"], row["TH1500"], row["InitType"]);
                matnum=matnum+1;
            }

            srOut.Close();
        }
        
        public DataTable CalculateRoot(DataTable dtNode, DataTable dtGrid, double ProfileDepth, double PlantingDepth, double xRootExtent, double rootweightperslab)
        {
            // parameters for root density calcs
            // dx and dy are diffusion coefficients, d1x,d2x, etc are temporary variables
            double difx = 10, dify = 100;
            double  x, y;
            double M = 1, time = 2;
            
            double root1, root2;
            int i, j, k, l; //indices of elements
            int Node;
            double TotalRTWT = 0;
            double AE1, CK1, BJ1, CJ1, BK1;
            double AE2, CK2, BJ2, CJ2, BK2;
            double rootweightperslab1;
            double[] NodeArea = new double[5000];

            
            // WSun add nodearea calculations

           // dtNode.Columns.Add(new DataColumn("NodeArea", typeof(double)));
            foreach (DataRow Dr in dtGrid.Rows)
            {
                 i = (int)Dr["TL"];
                 j = (int)Dr["BL"];
                 k = (int)Dr["BR"];
                 l = (int)Dr["TR"];
           
           if (k==l)
                {
                    CJ1 = (double)dtNode.Rows[i - 1]["X"] - (double)dtNode.Rows[k - 1]["X"];
                    CK1 = (double)dtNode.Rows[j - 1]["X"] - (double)dtNode.Rows[i - 1]["X"];
                    BJ1 = (double)dtNode.Rows[k - 1]["Y"] - (double)dtNode.Rows[i - 1]["Y"];
                    BK1 = (double)dtNode.Rows[i - 1]["Y"] - (double)dtNode.Rows[j - 1]["Y"];

                    AE1 = (CK1 * BJ1 - CJ1 * BK1) / 2.0;

                    NodeArea[i] = NodeArea[i] + AE1 / 3.0;
                    NodeArea[j] = NodeArea[j] + AE1 / 3.0;
                    NodeArea[k] = NodeArea[k] + AE1 / 3.0;
                }
           
             else 

              {
                    CJ1 = (double)dtNode.Rows[i - 1]["X"] - (double)dtNode.Rows[k - 1]["X"];
                    CK1 = (double)dtNode.Rows[j - 1]["X"] - (double)dtNode.Rows[i - 1]["X"];
                    BJ1 = (double)dtNode.Rows[k - 1]["Y"] - (double)dtNode.Rows[i - 1]["Y"];
                    BK1 = (double)dtNode.Rows[i - 1]["Y"] - (double)dtNode.Rows[j - 1]["Y"];

                    AE1 = (CK1 * BJ1 - CJ1 * BK1) / 2.0;

                    NodeArea[i] = NodeArea[i] + AE1 / 3.0;
                    NodeArea[j] = NodeArea[j] + AE1 / 3.0;
                    NodeArea[k] = NodeArea[k] + AE1 / 3.0;

                    CJ2 = (double)dtNode.Rows[i - 1]["X"] - (double)dtNode.Rows[l - 1]["X"];
                    CK2 = (double)dtNode.Rows[k - 1]["X"] - (double)dtNode.Rows[i - 1]["X"];
                    BJ2 = (double)dtNode.Rows[l - 1]["Y"] - (double)dtNode.Rows[i - 1]["Y"];
                    BK2 = (double)dtNode.Rows[i - 1]["Y"] - (double)dtNode.Rows[k - 1]["Y"];
                    
                    AE2 = (CK2 * BJ2 - CJ2 * BK2) / 2.0;

                    NodeArea[i] = NodeArea[i] + AE2 / 3.0;
                    NodeArea[k] = NodeArea[k] + AE2 / 3.0;
                    NodeArea[l] = NodeArea[l] + AE2 / 3.0;

               }

            }

            //dtNode.Columns.Add(new DataColumn("RTWT0", typeof(double))); //WSun RTWT0 represents relative number of root density (no relationship with any physical) 
            //dtNode.Columns.Add(new DataColumn("RTWT1", typeof(double)));  // WSun RTWT1 represents the multiplication of RTWT0 and node area
            foreach (DataRow Dr in dtNode.Rows)
            {
              
                Node = (int)Dr["Node"];
                x = (double)Dr["X"];
                y = ProfileDepth - (double)Dr["Y"];
                Dr["RTWT0"] = 0;
                Dr["NodeArea"] = NodeArea[Node];

                if (y <= PlantingDepth * 2.0 && x <= xRootExtent)
                {
                      root2=1.0/(4*time)*(x*x/difx+y*y/dify);
                    
                    root1 = M / (4.0 * 3.1415 * time * Math.Sqrt(difx * dify)); 
                                      
                    Dr["RTWT0"] = root1*Math.Exp(-root2); // need to drop the row at the end?
                                                         // RTWT = Dr["RTWT"];
 
                }
                Dr["RTWT1"] = ((double)dtNode.Rows[Node-1]["NodeArea"])*((double)dtNode.Rows[Node-1]["RTWT0"]); // WSun RTWT1 represents the multiplication of RTWT0 and node area
                TotalRTWT = TotalRTWT + (double)Dr["RTWT1"];// WSun TotalRTWT represents the sum of RTWT1

            }

            //Console.WriteLine("Total root weight: {0}\n", TotalRTWT);
            //Find nodes and associated elements. 

            // then find the center of the node to get a distance
            // can get node numbers for elements from dtElement and x,y from dt Node
            //calc roots as per x and y 
            // first find centers of the elements where x< 20 and y< 20, 
            // calculate roots at these xs and ys

            // WSun Calculation the root density (RTWT) which read by SPUDSIM 
            rootweightperslab1 = (rootweightperslab/TotalRTWT);  // WSun  rootweightperslab1 represents the division of root weight per slab and Total RTWT

            //dtNode.Columns.Add(new DataColumn("RTWT", typeof(double))); // WSun RTWT represents the root density which read by SPUDSIM
            foreach (DataRow Dr in dtNode.Rows)
            {
                Node = (int)Dr["Node"];
                Dr["RTWT"] = ((double)dtNode.Rows[Node - 1]["RTWT0"]) * rootweightperslab1;
            }

            return dtNode;

        }
        public int WriteParamToSoilFile (string SoilFileName, DataTable dtLayers)
        {
            int done=0;
            StreamWriter srOut = new StreamWriter(new FileStream(SoilFileName, FileMode.Create, FileAccess.Write));
            srOut.WriteLine("           *** Material information ****                                                                   g/g  ");
            srOut.WriteLine("   thr       ths         tha       th      Alfa      n        Ks         Kk       thk       BulkD     OM    Sand    Silt   InitType");
            foreach (DataRow row in dtLayers.Rows)
            {
                srOut.WriteLine(" {0:0.000}\t {1:0.000}\t {2:0.000}\t {3:0.000}\t {4:0.00000}\t {5:0.00000}\t {6:0.000}\t"   
                                   + " {7:0.000}\t  {8:0.000}\t {9:0.000}\t {10:0.0000}\t {11:0.00}\t {12:0.00}\t  {13:''}",

                                   row["thr"], row["ths"], row["tha"], row["thm"],
                                    row["alpha"], row["n"], row["Ks"], row["Kk"],
                                     row["thk"], row["BD"], row["OM"], row["sand"],row["silt"], row["InitType"]);
            }

            done = 1;
            srOut.Close();
            return done;
        }

    } // end class utilities
}
