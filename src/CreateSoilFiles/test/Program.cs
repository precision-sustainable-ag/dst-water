//Input run file and layer file on the command line 
//ToDo:
/*
 * 1. Read in van G params rather than generate them 
 * 2. Fix call to rosetta so it does not require user input to exit memory
 * 3. right now the pedotransfer function is all or nothing. at some point in the future we
 *    can modify the code to use a pedotransfer for some rows or variables and input for others

 * 
  12/10/2014 modified program to read one input file containing soil and initialization information
 * Provided option to create a soil file:
 *  If you are building a soil file, the program will take the soil file name, delete it and replace with the extension
 *   '.txt'. This is a temporary file. The program will put the soil properties into this file before it writes it. This
 *   file is read by rosetta. Rosetta will replace the extension with '.soi' when outputting the result.
 *   note - Mar 2018 - soil file root name is now input
 *   
 *   12/16/2015 labeled old program version 0.02 and began complete revision. I added command line switches to carry out different 
 *   tasks - see the documentation below. No longer uses a run file, all files are read from and written to the folder from
 *   where the program is executed. I reorganized the layer file again so that we no longer need to specify if a new grid or new
 *   soil file will be generated based on input from the layer file. This information now comes from the command line. 
 *   I'll keep the information in the file now but it won't be used
 *   
 *  added information to build soil file - van Genuchten by default --DONE
 *  added information to build solute file (nitrogen and other solutes -- Done for nitrogen and carbon in OM
 *  added information to customize boundary conditions Done
 *  added initial root density - DONE
 *  modified inputs for rosetta and add an argument for model type so rosetta can use th33 and th1500 Done
 *  
 *  3/9/2018 modified program to read the soil file name on the command line. 
 *           fixed the problem where the program could not generate files for a layer file with one layer
 *           The program can now read in -1 for the vanG parameters and generate them using Rosetta
 *           if the parameters are not -1 then it uses them from the layer file. 
 *           I still need to be able to generate the soil water retention and input only KS or maybe use a different 
 *           relationship though this has to be done in 2dsoil
 *         
 * 2/20/2020 modified program to handle case where initial water is matric potential (m) or water content (w)
 *            I had to remove the interpolation of hnew from layer to nodal file because some layers could have 
 *            water as the initial condition and others matric potential. 
 *            I removed the element file manipulations from the dll and this program. Still have to move the initial
 *            root concentrtions to the nodal file so david can use it.
 *            
 * 2/27/2020  modified program to create the x nodes instead of reading them. I reused the CalcYnodes method and added row spacing 
 *              as an input value. The ratio is hard coded as 1.27 or so.
 *              
 * 4/10/2020  WSun modified program to add a new column (soil density) in nodal file.        
 * 5/4/2020   DT removed all references to element files and tables
 *             
 */
using System;
using System.Runtime.InteropServices; //for fortran calling
using System.Collections.Generic;
using System.Collections;
using System.Linq;
using System.Text;
using System.Data;
using System.IO;
using System.Diagnostics;
using System.Text.RegularExpressions;
// methods:
// ParseRunFile
// ParseGridFile
namespace test_database_app
{

    public struct inFiles
    {
        public String NodeFile;
        public String GridFileForOutput;
        public String SoilFileForOutput; //contains van genuchten params
        public String SoilFile; // sand silt clay data and theta33 theta1500 if avail to create van genuchten params
        public String GridFileRoot; //filename root, when a new grid is specified, this will be the name before the extension
    }
   public enum methodnum
    {
        GN, GM, SN, SM, GR
    }

    class Program
    {
        // Note: this is the unmanaged method to include a dll. YOu have to specifiy each subroutine using a public static extern command
        // for some reason I had to use an int return value even though I had a subroutine and not a function. It runs fine so far
        // the dll has to be copied to the debug bin folder of the c# parent project.
        // there is a way to create a managaged subroutine by "wrapping" the fortran sub in a c# class. When this is done, you can add the
        // project as an reference and use a '.' operator to access the methods
        // http://software.intel.com/en-us/articles/calling-fortran-function-or-subroutine-in-dll-from-c-code/
        // At any rate, you still have to use a dllImport statement in the wrapper. You can reuse it though without having to repeat the dllimport statement.
        [DllImport("GridGenDll.dll")]
        public static extern int GRIDGENDLL();
        // The program reads a layer file that contains the soil profile information organized as layers. 
        // The 'run' file from the 2dsoil based model is also needed to know the locations of the grid, node and layer  files to be
        // written to         

        static void Main(string[] args)
        {
            int ArgCount;
        
            byte Method;
            //holds indicator for type of file to generate
              //0001= new grid /GN (1)
              //0010= Modify Grid  /GM (2) 
              //0100= new soil file  /SN (4)
              //1000= Generate roots /GR (8)
              //0101= new grid and soil file /GN /SN (5)
              //0110= modify grid and new soil file /GM /SN (6) 

              //1011= Generate roots and new grid/GN /GR (9) 
              //1100= Generate roots and modify grid /GM /GR (10)
              //1101=     Generate roots and new grid and soil /GR /GN /SN (13)
              //1110=     Generate roots and new soil modify grid /GR /SN /GM (14) 


            // generating roots is only useful for a new grid GN (1) or modifying one GM (2) --> 09 and 10

            double PERCENT_C =0.58; // proportion of OM that is carbon
            double PERCENT_N=0.05; //Proportion of OM that is Nitrogen
            char[] charSeparators1 = new char[] { ':', ' ', '\t' };  // needed for parsing strings
            char[] charSeparators2 = new char[] { ' ', '\t' };
            int MatNum = 0, i, j;  //counters
            double ProfileDepth = 0, PlantingDepth = 0, xRootExtent = 0, RowSpacing=0;
            double rootweightperslab = 0;
            double LowerDepth, UpperDepth;

            double SurfaceIntervalRatio = 0; //ratio of the distance between two neighboring nodes for the geometric progression for the 
            double InternalIntervalRatio = 0;                            //surface boundary and subsurface boundary respectively
            //these are set now but will be input to program later
            double FirstSurfaceInterval = 0.25;
            double FirstInternalInterval = 1.0;

            ArrayList argsList =new ArrayList();
            
            Utilities myUtil = new Utilities();  // utilities are for parsing and writing files.
            inFiles TheseFiles = new inFiles();  //global structure that holds the names of the files that are input

            ArrayList FieldArray = new ArrayList();  //holds rows from the layer file
                                                     //Consider changing this to List<T> where T is a type - won't have to cast
            String LayerFile, GridTemplateFile = " ", GridGenInput = "dataGen2.dat";
            String[] strFields; // holds strings parsed from larger ones
            String SoilFile = "";  // holds string to decide on creating a soil file NoSoil/Soil - 
                                   //this is passed to rosetta with the sand, silt and clay etc values 
                                   // It is then overwritten with the output data only needs to be temporary

            String GridFileRoot = ""; //holds the root for the grid file
            String expression;
            String myPath;
            myPath = System.Environment.CurrentDirectory;
            Console.WriteLine(myPath);
            String errorLog=myPath+ @"\createError.log"; // file to store errors
            StreamWriter errorOut = new StreamWriter(new FileStream(errorLog, FileMode.Create, FileAccess.Write));

            ArrayList Segment1 = new ArrayList();    //holds line information with row spacing
            ArrayList Segment2 = new ArrayList();
            List<double> xSegment = new List<double>(); // holds x nodes - I am using the updated collection List instead of ArrayList
            // it can be typed at declaration
            ArrayList MasterSegment = new ArrayList(); // holds the individual segments for the Y nodes

           
            Int16 BottomBC, GasBCTop, GasBCBottom;     //Holds boundary code for bottom boundary, -2 for seepage, 1 for constant, 7 for drainage.
                                          //GasBC at the top -4 or 1, bottom BC is 1 or 0
           
            bool NewGrid = false;  //set true if grid will be generated from scratch rather than use a template false by default
            bool NewSoil = false; //set true if a new soil file will be generated
            bool ModGrid = false; //set true if existing grid will be modified
            bool ModSoil = false; //set true if existing soil file will be modified - to be deleted.
            bool GenRoot = false; //true to generate roots in nodal file. /TODO not used yet, need t 
            // it is set true for debugging purposes until the method is finished. 
            
            // the following three tables are filled in the Utilities class. The tables are returned by the methods
            DataTable dtGrid = new DataTable(); //holds grid information
            DataTable dtNodal = new DataTable(); //holds nodal initialization information
            DataTable dtElem4Grid = new DataTable();  //holds element information for the grid file

            //DataTable dtElement = new DataTable();   //holds element information for the element file
            DataSet dsGrid = new DataSet();      //holds element and nodal tables it is filled in the utilities class
            DataRow[] myRow;                     // holds row values from search
            DataRow dr;                          //temporary holder for row

            // define table to hold input data (from layer file)
            DataTable dtLayers = new DataTable("Layers");
            dtLayers.Columns.Add(new DataColumn("Depth", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("InitType", typeof(string)));
            dtLayers.Columns.Add(new DataColumn("OM", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("NO3", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("NH4", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("hNew", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("Tmpr", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("CO2", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("O2", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("Sand", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("Silt", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("Clay", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("BD", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("TH33", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("TH1500", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("thr", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("ths", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("tha", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("th", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("alpha", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("n", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("ks", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("kk", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("thk", typeof(double)));
            // the following columns are not in the input data but are needed for calculations
            dtLayers.Columns.Add(new DataColumn("OM_Slope", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("NO3_Slope", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("NH4_Slope", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("hNew_Slope", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("Tmpr_Slope", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("CO2_Slope", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("O2_Slope", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("Sand_Slope", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("Silt_Slope", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("Clay_Slope", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("BD_Slope", typeof(double)));
            
            dtLayers.Columns.Add(new DataColumn("Y", typeof(double)));
            dtLayers.Columns.Add(new DataColumn("Y_Mid", typeof(double)));
            


            /* For the case of a template:
             * get run.dat file to obtain grid file name
             * open grid file
             * parse to determine node numbers and associated layers
             * Will have depth distribution and layer numbers
             * LayerFile an input file with layer information x, y, material number, sand, silt, clay, om, temperature range
             * Also has name of file with soil texture info for soil hydraulic params. 
             * If the soil hydraulic parameters are >0 then the program will read the parameters from the database
             * to greate the soil hydrualic properties file
             * If the soil hydraulic properties are <0 then the program will call rosetta.exe to calculate 
             * soil hydraulic params. The texture file will have the extension '.dat' the soil file
             * must be the same with the extension '.soi'. This file will be generated by the rosetta program
             * The texture file name will be autogenerated from the soil file name by substituting 'soi' for 'dat'
             *
             */

            if (args.Length <=1)
            {
                Console.WriteLine("Please run the program as CreateSoilFiles <soil layer file name> along with:");
                Console.WriteLine(" /GN <grid base name> to create a new grid");
                Console.WriteLine(" /GM <Grid base name> to change nodal values");
                Console.WriteLine(" /SN  <Base Soil file name> to create a new soil file name");
                Console.WriteLine(" /GR to generate a root density");
                Console.WriteLine(" you can use one or more of the above switches, e.g., CreateSoilFiles mySoil.lyr /GN myGrid /SN ");
                
                return ;
            }
            LayerFile = args[0];
            ArgCount=args.Count();
             
              //we have 4 possible arguments after the layer file:
              ///GN <grid base name> (1)
              ///GM <grid base name>  (2)
              ///SN <soil file name>  (3)
              //GR                    (4)
              //Need to parse these out. Find each one and do some action
            int er; // flag for errors in parameter count
            String thisarg;
            String test ="/";
            methodnum value;
            Method = 0;
          
            for (i = 0; i <= ArgCount-1; i++)
            {
                
                argsList.Add(args[i]);
                if (args[i].Substring(0, 1).Equals(test))
                {
                    thisarg = args[i].Replace("/", string.Empty);
                    try
                    {
                        value = (methodnum)Enum.Parse(typeof(methodnum), thisarg);
                    }
                    catch
                    {
                        Console.WriteLine("parameter must match /SN /GN /GM /R ");
                            return;
                    }


                    switch (value)
                    {
                        case methodnum.GN:
                            {
                                Method= (byte)(Method + 1);
                                GridFileRoot = args[i +1];
                                NewGrid=true;
                                if (GridFileRoot.Contains(test))
                                {
                                  Console.WriteLine("next string after switch should be a string for the file name");
                                  return;
                                }

                                
                                break;
                            }
                        case methodnum.GM:
                            {
                                Method= (byte)(Method+2);
                                if (Method>2)
                                {
                                    errorOut.WriteLine("Cannot use GM and GN together");
                                    return;
                                }
                                ModGrid=true;
                                if (i <= ArgCount-1)
                                {
                                    GridFileRoot = args[i +1];
                                    if (GridFileRoot.Contains(test))
                                    {
                                        errorOut.WriteLine("next string after switch should be a string for the file name");
                                        return;
                                    }
                                }
                                if (i > ArgCount-1) return; 
                                break;
                            }
                        case methodnum.SN:
                            {
                                Method=(byte)(Method+4);
                                SoilFile = args[i + 1] + ".dat";
                                if (SoilFile.Contains(test))
                                {
                                    errorOut.WriteLine("next string after switch should be a string for the soil file name");
                                    return;

                                }
                                NewSoil=true;
                                break;
                            }
                        
                        case methodnum.GR:
                            {
                                Method = (byte)(Method + 8);
                                GenRoot = true;
                                break;
                            }
                        default: Method = 0;
                            break;
                    }
                    
                }
            }
            //now find methods in list and set flags based on method
            if (Method ==0 | Method==3 | Method==7 |Method==11 |Method >14 )
            {
                errorOut.WriteLine("Error in input line. Switch is missing or wrong combination, please enter a command like /GM /GN /SM /SN /GR");
                return;
            }

          
/*          Don't think I need this, should be taken care of above. 
 *          if (Method == 1 | Method == 5 | Method == 9 | Method==13)
                NewGrid = true;

            if (Method == 4 | Method == 5 | Method == 6 |Method==13 | Method==14)
                NewSoil = true;

            if (Method == 8 | Method == 9 | Method == 10 || Method == 13 | Method == 14)
                GenRoot = true;
*/
            // get file names from run file for nodes, grid and elements
            // the variable 'TheseFiles' is a structure
            if (Method == 1 | Method == 2 | Method == 5 | Method==6 | Method == 8 | Method == 9 | Method==10 | Method == 13 | Method==14)

            {
                   TheseFiles =myUtil.CreateGridFiles(GridFileRoot);
            }
               
            TheseFiles.SoilFile = SoilFile;

        
            
            // May add use of run file later - now we will just use a stub
//            TheseFiles = myUtil.ParseRunFile(RunFile);

            // set up grid files if method is to modify or create a grid




            //get layer information  first   
            StreamReader sr = new StreamReader(new FileStream(LayerFile, FileMode.Open, FileAccess.Read));
            //strFields is a string array (expandable) to hold the line of data read from file
            //Get surface ratio and internal ratio information
            sr.ReadLine();  //get header
            strFields = sr.ReadLine().Split(charSeparators1, StringSplitOptions.RemoveEmptyEntries);
            SurfaceIntervalRatio = Convert.ToDouble(strFields[0]); //SIR
            FirstSurfaceInterval = Convert.ToDouble(strFields[1]); //FSI
            InternalIntervalRatio = Convert.ToDouble(strFields[2]); //IIR
            FirstInternalInterval = Convert.ToDouble(strFields[3]); //FII

            sr.ReadLine(); //get next header 
            // input RowSpacing
            strFields = sr.ReadLine().Split(charSeparators1, StringSplitOptions.RemoveEmptyEntries);
            RowSpacing = Convert.ToDouble(strFields[0]);

            sr.ReadLine(); //get header for planting depth
            //}
            // Read planting depth (for root calculations)
            strFields = sr.ReadLine().Split(charSeparators1, StringSplitOptions.RemoveEmptyEntries);
            PlantingDepth = Convert.ToDouble(strFields[0]);
            xRootExtent = Convert.ToDouble(strFields[1]); 
            rootweightperslab = Convert.ToDouble(strFields[2]);//root weight per slab
            // get boundary code
            sr.ReadLine();   // get header for boundary code line
            sr.ReadLine();
            strFields= sr.ReadLine().Split(charSeparators1, StringSplitOptions.RemoveEmptyEntries);
            BottomBC = Convert.ToInt16(strFields[0]);
            GasBCTop = Convert.ToInt16(strFields[1]);
            GasBCBottom= Convert.ToInt16(strFields[2]);
            sr.ReadLine();
            sr.ReadLine(); // get header for soil properties
            //Bottom depth   InitType   OM     no3          NH4      hNew      Tmpr ..
            //                Sand Silt Clay  BD   TH33  TH1500  thr	ths	tha	th	Alfa	n	Ks	Kk	thk
            //This section parses the line of data read from the layer file to obtain individual values
            // layer table is built for all scenarios, even soil only ones.
            do
            {
                dr = dtLayers.NewRow();
                strFields = sr.ReadLine().Split(charSeparators2, StringSplitOptions.RemoveEmptyEntries);
                if (strFields.Length > 0)
                {
                    FieldArray.Add(strFields);
                    for (i = 0; i < strFields.Count(); i++)
                    {
                        if (Regex.IsMatch(strFields[i], "[a-z]"))
                            dr[i] = Convert.ToString(strFields[i]);
                          else
                             dr[i] = Convert.ToDouble(strFields[i]);
                    }
                    dtLayers.Rows.Add(dr);
                    MatNum = FieldArray.Count;
                }
            } while (!sr.EndOfStream);



            ProfileDepth = Convert.ToDouble(dtLayers.Rows[MatNum - 1][0]);

            //Field array holds rows of soil layer data as does the dtLayers table.
            // at some point we can get rid of the FieldArray variable.
            //there is one row for each layer. It is an image of the layer.dat file

            //Now calculate midpoint depths in interior layers for use in interpolation later
            // Also calculate Nitrogen and Carbon concentrations from litter and OM additions
            // don't have litter and manure yet but will have it in the future

            dtLayers.Rows[0]["Y"] = (float)ProfileDepth - Convert.ToSingle(dtLayers.Rows[0]["Depth"]);
            dtLayers.Rows[0]["Y_Mid"] = ProfileDepth;
            dtLayers.Rows[MatNum - 1]["Y"] = (float)ProfileDepth - Convert.ToSingle(dtLayers.Rows[MatNum - 1]["Depth"]);  // make sure precision doesn't result in a number
            dtLayers.Rows[MatNum - 1]["Y_Mid"] = (double)dtLayers.Rows[MatNum - 1]["Y"];                                 // close to zero but not zero - use float.
           

            double TempCalc;
            for (i = 1; i < MatNum - 1; i++)
            {
                dtLayers.Rows[i]["Y"] = (float)ProfileDepth - Convert.ToSingle(dtLayers.Rows[i]["Depth"]);
                dtLayers.Rows[i]["Y_Mid"] = (Convert.ToSingle(dtLayers.Rows[i - 1]["Y"]) - Convert.ToSingle(dtLayers.Rows[i]["Y"])) / 2.0;
                dtLayers.Rows[i]["Y_Mid"] = (double)dtLayers.Rows[i]["Y_Mid"] + (double)dtLayers.Rows[i]["Y"];
            }

            //Now calculate slopes of changes in properties from layer to layer so we can interpolate
            //If we add columns after OM then we have to increase the counter in dtLayers.Rows[i + 1][j - 21]. j-21 should begin
            // I think this should be the total number of columns minus the number of columns before OM
            //with column 2 if we add anything after OM. if you add a column before OM then decrease this number
            // 

            for (i = 0; i < MatNum - 1; i++)
            {
                for (j = dtLayers.Columns.IndexOf("thk")+1; j < dtLayers.Columns.Count - 2; j++)  //slopes begin at column 13 (add one for each new column in layer file
                                                                                                  //before thk, last two columns are y and y_mid values
                {
                        dtLayers.Rows[i][j] = ((double)dtLayers.Rows[i + 1][j - 22] - (double)dtLayers.Rows[i][j - 22])
                                           / ((double)dtLayers.Rows[i + 1]["Y_Mid"] - (double)dtLayers.Rows[i]["Y_Mid"]); // calculate slopes needed to interpolate
                    // soil properties through the profile

                }
            }

            // Need a decision point here. 


            // 1-We build a grid file from scratch. For this we need - lower depth, material depths, boundary conditions
            // but BC can be set at first. The descritization of the nodes must be handled first. We create the file data2Gen.dat to send
            // to the grid generator


            // 2-If we use a template for the grid file we need to either parse the existing grid file or use an existing data2Gen file. In this 
            // case we have the grid information, we only need to fill in the material numbers

            if (NewGrid | ModGrid)
            {   //we will create a gridgen file and use it to call the mesh generator 
                //This code will create the input file.
                // Get depth of profile
                //ToDo: rewrite this to use dtLayer table instead of the strings
                String[] myField = (String[])FieldArray[MatNum - 1];

                //Do first layer for testing
                String[] Layer = (String[])FieldArray[0];
                double Layer1 = Convert.ToDouble(Layer[0]);
                double upper = ProfileDepth;
                double lower = ProfileDepth - Layer1;
                Double mid = (upper - lower) / 2.0;

                // number of segments, Segment Length Ratio, start node, initial length, direction
                Segment1 = myUtil.CaclYNodes(SurfaceIntervalRatio, mid, upper, FirstSurfaceInterval, 1);
                int count = Segment1.Count;
                Segment1.RemoveAt(count - 1); //last number is redundent for the two
                MyCustomComparer thiscomparer = new MyCustomComparer();
                Segment2 = myUtil.CaclYNodes(InternalIntervalRatio, mid, lower, FirstInternalInterval, -1);
                Segment2.Sort(thiscomparer);
                count = Segment2.Count;
                Segment2.RemoveAt(count - 1); //last number is redundent for the two
                MasterSegment.Add(Segment1);
                MasterSegment.Add(Segment2);
                // need to store segment 1 and 2
                if (MatNum > 1)
                {
                    for (i = 1; i < MatNum; i++)
                    {
                        upper = lower;
                        Layer = (String[])FieldArray[i]; //get the next layer information as a string
                        lower = ProfileDepth - (Convert.ToDouble(Layer[0]));  // the first item in the layer string is the depth
                        mid = (upper - lower) / 2.0;
                        Segment1 = myUtil.CaclYNodes(InternalIntervalRatio, mid, upper, FirstInternalInterval, 1);
                        count = Segment1.Count;
                        Segment1.RemoveAt(count - 1); //last number is redundent for the two
                        Segment2 = myUtil.CaclYNodes(SurfaceIntervalRatio, mid, lower, FirstInternalInterval, -1);
                        Segment2.Sort(thiscomparer);
                        count = Segment2.Count;
                        Segment2.RemoveAt(count - 1); //last number is redundent for the two
                        MasterSegment.Add(Segment1);
                        MasterSegment.Add(Segment2);

                    }
                }
                xSegment = myUtil.CaclXNodes(RowSpacing);
                //Now write data to input files needed for the grid generator
                myUtil.WriteToGridGenFile(GridGenInput, MasterSegment, xSegment, BottomBC, GasBCTop, GasBCBottom);
                try
                {
                    GRIDGENDLL();  //call fortran program here
                    GridTemplateFile = "Grid_bnd";
                   // ElementTemplateFile = "element_elm";
                }
                catch(Exception thisError)
                {
                    errorOut.WriteLine(thisError.Message);
                }
                // Delete datagen2.dat
                string fname = myPath + "\\dataGen2.dat";
                try
                {
                    File.Delete(fname);
                }
                catch (IOException DelError)
                {
                 //   errorOut.WriteLine(DelError.Message);
                }
                // the file Grid_bnd has just been created by the dll. it has no layers yet. The following code introduces layers
                // if we want to modify and existing grid we can start here.
          // end of old paren for new grid
            // case 1
            //dtGrid holds the grid as a DataTable. The function below creates the table and fills
            // it with data from the grid template.
            // if (!NewGrid)
            {
                dsGrid = myUtil.ParseGridFile(GridTemplateFile);
                
                dtNodal = dsGrid.Tables[0];
                dtElem4Grid = dsGrid.Tables[1];
                int NumElements=dtElem4Grid.Rows.Count;
               //In order to find the maximum depth of the profile we have to query the
                    // column with "Y" data.
                    myRow = null;

                   myRow = dtNodal.Select("Y=MAX(Y)");  // this selects a subset of the rows from the table where y=max(y)
                                                             // myRow is an array of rows
                   
                ProfileDepth = (double)myRow[0]["Y"]; // select a single value form one row (the first one) from column with "Y" values
                LowerDepth = 0;  //need to initialize first before using them.
                UpperDepth = 0;

                //now select rows that match the upper and lower depths specified for each material (layer) in the layer file
                for (i = 0; i < MatNum; i++)
                {
                    //FieldArray is a collection of Field (string) arrays (lines read from layer file - a string array)
                    // here we select one line of data (a string). Note that field array is a collection of objects. The type
                    // of object is not stored. Thus we need to cast the FieldArray member as a string before assigning it
                    // to the string variable myField.
                    /*String[]*/ myField = (String[])FieldArray[i];
                    //need separate selection criteria for first layer in order to be inclusive of both bottom and top values
                    // because of the use of <= or just <.
                    if (i == 0)
                    {
                        UpperDepth = ProfileDepth;
                        LowerDepth = ProfileDepth - Convert.ToDouble(myField[0]);
                    }
                    if (i > 0)
                    {
                        UpperDepth = LowerDepth;
                        LowerDepth = ProfileDepth - Convert.ToDouble(myField[0]);
                    }

                    // create a selection expression to select rows of the table that have "Y" values within the 
                    // range of the layering scheme
                    expression = "Y>=" + LowerDepth.ToString() + " and Y<" + UpperDepth.ToString();
                    if (i == 0) expression = "Y>=" + LowerDepth.ToString() + " and Y<=" + UpperDepth.ToString();
                    // select the rows falling within the ranges of depth for that layer
                    myRow = dtNodal.Select(expression);
                    // standard method to loop within a DataTable
                    foreach (DataRow Row in myRow)
                    {
                        Row["MatNum"] = i + 1; //assign a material number
                    }
                } //end for i loop
                // next do elements. Now that we know the material numbers for the nodes we can use that information to fill in the material numbers
                // for the elements. We assume that the bottom of the element is the boundary for the layer. Based on the algorithms we use, a boundary
                // will never pass through the middle of an element. The bottom two nodes of the element (3rd and 4th positions in the row are the decision ones.
                // the element will always have the material number of the bottom two nodes. But, since we only need one we will use the one on the left (BL) -
                // index 2 (starting from 0)
                // no need to use a for loop, tables have their own built in mechanism for looping
                int NodeBL;
                foreach (DataRow Row in dtElem4Grid.Rows)
                {
                    NodeBL = (int)Row["BL"];
                    expression = "Node=" + NodeBL.ToString();
                    myRow = dtNodal.Select(expression); // I think myRow is actually a collection of nodes
                    Row[5] = myRow[0].ItemArray[3];

                }

                // now output grid file

                myUtil.WriteGridFile(dsGrid, TheseFiles.GridFileForOutput, GridTemplateFile, MatNum, BottomBC, GasBCTop, GasBCBottom);
                                dtGrid = dsGrid.Tables["Node"];
                    //Now get Nodal Data. Need node numbers from grid table and other information from layer file
                    myUtil.CalculateRoot(dsGrid.Tables["Node"], dtElem4Grid, ProfileDepth, PlantingDepth, xRootExtent, rootweightperslab);// WSun call root density and add a new column in nodal file
                    dtNodal = myUtil.CreateNodalTable(dtGrid);
                  
                    // add root information to element table
                    // if (GenRoot)
                    // WSun call root density and add a new column in nodal file
                    //{
                  //  myUtil.CalculateRoot(dsGrid.Tables["Node"], dtElem4Grid, ProfileDepth, PlantingDepth, xRootExtent);
               // }


                    // Now add layer information to the nodal table
                    //If we have only one layer there is no need to interpolate
                    // big error here, this code will never execute!!, Matnum is not likely to be one
                    // if (MatNum == 1)
                    //select MatNum==1
                    expression = "MatNum=1";
                    myRow = dtNodal.Select(expression);
                    foreach (DataRow row in myRow)
                    {
                        // caculate Nh and Ch here. Need OM and BD.
                        row["NO3"] = Convert.ToDouble(dtLayers.Rows[0]["NO3"]); //initially it is ppm or g NO3 per 1,000,000 grams of soil (ug/g) 
                        row["Tmpr"] = Convert.ToDouble(dtLayers.Rows[0]["Tmpr"]);
                        row["CO2"] = Convert.ToDouble(dtLayers.Rows[0]["CO2"]);
                        row["O2"] = Convert.ToDouble(dtLayers.Rows[0]["O2"]);
                        row["hNew"] = Convert.ToDouble(dtLayers.Rows[0]["hNew"]);
                        row["NH4"] = Convert.ToDouble(dtLayers.Rows[0]["NH4"]);
                        TempCalc = ((double)dtLayers.Rows[0]["BD"] * 1.0e6   //gives ug per cm3
                                 * (double)dtLayers.Rows[0]["OM"]);          //gives ug OM cm3
                        row["Ch"] = TempCalc * PERCENT_C;                    //gives ug organic C per cm3 soil
                        row["Nh"] = TempCalc * PERCENT_N;   //gives ug organic N per cm3 soil
                        
                    } // finished looping through row
      
                for (i = 0; i < MatNum - 1; i++)
                {
                    //we have only two regression equations for two or more intervals. I'm not sure if this will work for one or two layers
                    // may have to have dummy layers for that case
                    expression = "Y<=" + dtLayers.Rows[i]["Y_Mid"].ToString() + " and " + "Y>" + dtLayers.Rows[i + 1]["Y_Mid"].ToString();
                    if (i == MatNum - 2)
                    {
                        //in the last case we need to catch the bottom of the last layer as well. This will be filtered out if 
                        //Y> is used
                        expression = "Y<=" + dtLayers.Rows[i]["Y_Mid"].ToString() + " and " + "Y>=" + dtLayers.Rows[i + 1]["Y_Mid"].ToString();
                    }


                    myRow = dtNodal.Select(expression);
                    //Since FieldArray is a collection of objects, we have to cast as a string before assigning.

                    // This line chooses one string object in the collection of FieldArray that corresponds to the layer
                    // DOn't need it now using dtLayers

                    //String [] myField = (String []) FieldArray[i];

                    // note that multiple rows will be chosen for each layer, this loops through the rows and 
                    // assigns values for that layer
                    float dy;
                        foreach (DataRow row in myRow)
                        {
                            dy = Convert.ToSingle(row["Y"]) - Convert.ToSingle(dtLayers.Rows[i]["Y_Mid"]);
                            // caculate Nh and Ch here. Need OM and BD.
                            row["NO3"] = Convert.ToDouble(dtLayers.Rows[i]["NO3"]) + Convert.ToDouble(dtLayers.Rows[i]["NO3_Slope"]) * dy;
                            row["Tmpr"] = Convert.ToDouble(dtLayers.Rows[i]["Tmpr"]) + Convert.ToDouble(dtLayers.Rows[i]["Tmpr_Slope"]) * dy;
                            row["CO2"] = Convert.ToDouble(dtLayers.Rows[i]["CO2"]) + Convert.ToDouble(dtLayers.Rows[i]["CO2_Slope"]) * dy;
                            row["O2"] = Convert.ToDouble(dtLayers.Rows[i]["O2"]) + Convert.ToDouble(dtLayers.Rows[i]["O2_Slope"]) * dy;

                            row["NH4"] = Convert.ToDouble(dtLayers.Rows[i]["NH4"]) + Convert.ToDouble(dtLayers.Rows[i]["NH4_Slope"]) * dy;
                            TempCalc = ((double)dtLayers.Rows[i]["BD"] + Convert.ToDouble(dtLayers.Rows[i]["BD_Slope"]) * dy) * 1.0e6
                                     * ((double)dtLayers.Rows[i]["OM"] + Convert.ToDouble(dtLayers.Rows[i]["OM_Slope"]) * dy);
                            row["Ch"] = TempCalc * PERCENT_C;
                            row["Nh"] = TempCalc * PERCENT_N;
                            
                        } // finished looping through row
                    } //finished looping through table
// for hNew
                    // need to do the same process for hNew on it's own since we cannot interpolate with different kinds of data (w or m)
                    for (i = 1; i < MatNum; i++)
                    {
                        
                        // we use MatNum here to select corresponding rows from  each table
                        int n = i + 1;
                        expression = "MatNum =" + n.ToString();
                        
                        myRow = dtNodal.Select(expression);
                        foreach (DataRow row in myRow)
                        {
                           
                            row["hNew"] = Convert.ToDouble(dtLayers.Rows[i]["hNew"]);// + Convert.ToDouble(dtLayers.Rows[i]["hNew_Slope"])* dy;
                        } // finished looping through row
                    } //finished looping through table

                    //drop matnum column since it is not part of the Nodal file
               
                    dtNodal.Columns.Remove("MatNum");
                    dtNodal.Columns.Remove("Y");
               
                    //Now write out the nodal and element data 
                    myUtil.WriteNodalFile(TheseFiles.NodeFile, dtNodal, dtLayers);
                
 

            }
            } //end if NewGrid
            //Now calculate soil parameters from the texture file (*.dat)
            if (NewSoil | ModSoil)
            {
                String FileNameForSoil=" ";
                try
                {
                    FileNameForSoil = Path.GetFileName(TheseFiles.SoilFile);
                   
                }
                catch (Exception thisError)
                {
                    errorOut.WriteLine(thisError.Message);
                }


                FileNameForSoil = myPath + "\\" + FileNameForSoil ;
                // call rosetta if the value of thr<0 otherwise we 
                // already have the hydrualic params.
                // Rosetta will output the soi file so no changes to the file
                // name are necessary
                if ((double) dtLayers.Rows[0]["thr"] < 0)
                {
                    Process Pr = new Process();
                   
                    ProcessStartInfo RosettaInfo = new ProcessStartInfo();
                    RosettaInfo.FileName = "rosetta.exe";
                   // add quotations around input file name. use the escapaping
                   // character. We don't need quotes for the C# path name files. Only
                   // here where the path and file are given on the command line 
                    RosettaInfo.Arguments = "\"" + FileNameForSoil + "\"" ;
                    myUtil.CreateSoilFile(dtLayers, FileNameForSoil);

                   

                    RosettaInfo.UseShellExecute = false;
                    try
                    {
                        Process.Start(RosettaInfo);
                    }
                    catch (Exception e)
                    {
                        errorOut.WriteLine("{0} Exception caught in RosettaInfo.UseShellExecute", e);
                    }

                   
                }
                else
                {
                    int res;
                    FileNameForSoil = FileNameForSoil.Replace(".dat", ".soi");
                    res =myUtil.WriteParamToSoilFile(FileNameForSoil, dtLayers);
                } 
                //Now copy resultant soi file
                    //FileNameForSoil = FileNameForSoil.Replace(".dat", ".soi");
                    //FileNameForSoil = myPath + "\\" + FileNameForSoil;
            }

            errorOut.Close();

        }//end main



    } //end class
} //end namespace
