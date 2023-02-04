' this one will select a subset of ID's
' this routine will initialize all paths

Sub MainSelect()
Set C = New Class1
Dim strSQL, strID, CurrentDrive As String
Dim sheet As Excel.Worksheet
strSQL = "SELECT ID FROM [Description$]"
Dim ThisWB As String
Dim loc, testStr As String
C.GetPaths
C.Connection
'C.GetMyWeather
C.rs.Open strSQL, C.cn, adOpenStatic
' open new worksheet
' could use FullName property as well
ThisWB = ThisWorkbook.path & "\" & ThisWorkbook.Name
Set sheet = ThisWorkbook.Worksheets("Interface")

sheet.Columns(3).Clear
IRange = "C1:C" & C.rs.RecordCount
 For Each r In sheet.Range(IRange)
        r.Value = C.rs("ID")
        C.rs.MoveNext
    Next r
C.rs.Close
'need to change to drive with data, etc
CurrentDrive = Left(ThisWB, InStr(ThisWB, ":") - 1) & ":"
    'loc = CurDir()
' now prompt to select worksheets
 Set Rng = Application.InputBox("Select a range", "Obtain Range Object", Type:=8)
 For Each C In Rng.Cells
      strID = C.Value
      
  'If InStr(strID, "N4") Or InStr(strID, "N5") Then
      MakeFolders (strID)
      WriteBio (strID)
      WriteIni (strID)
      WriteSol (strID)
      WriteGas (strID)
      WriteMan (strID)
      WriteMulch (strID)
      WriteLayer (strID)
      WriteTime (strID)
      WriteVar (strID)
      WriteClim (strID)
      WriteNit (strID)
      WriteRun (strID)
      WriteDrip (strID)
      WriteWea (strID)
 '   End If
  Next
sheet.Columns(3).Clear

End Sub
' creates folders for output data
Sub MakeFolders(idStr As String)

Dim C As Class1
Dim strSQL As String
Dim Folder As String
Dim fso As New FileSystemObject

Set C = New Class1
C.Connection


strSQL = "SELECT path FROM [Description$] where ID ='" + idStr + "'"
C.rs.Open strSQL, C.cn

Do Until C.rs.EOF
path = C.FilePathRoot + "\" + C.rs("path")
If Not fso.FolderExists(path) Then
'folder doesn't exist, so create full path
    fso.CreateFolder path
    C.rs.MoveNext

 Else
 C.rs.MoveNext
End If
Loop



C.rs.Close
C.cn.Close


End Sub
' Writes the biology file
Dim idStr As String
Dim C As Class1
Dim strSQL As String

Sub WriteBio(idStr As String)
Set C = New Class1
C.Connection
strSQL = "Select biology, path from [Description$] where id=""" + idStr + """"
C.rs2.Open strSQL, C.cn   ' has Biology file name and path
strSQL = "select  id, dthH, dThL, es, th_m, tb, QT, dthD, th_d from [Biology$]" _
       & " where ID = """ + C.rs2.Fields.Item(0) + """"
C.rs3.Open strSQL, C.cn
FilePath = C.FilePathRoot + "\" + C.rs2(1) + "\" + C.rs2(0) + ".bio"
Open FilePath For Output As #1
'Set oFile = fso.CreateTextFile(FilePath)
 Print #1, "*** Example 12.3: Parameters of abiotic responce: file 'SetAbio.dat'"
 Print #1, "Dehumification, mineralization, nitrification dependencies on moisture:"
 Print #1, " dThH    dThL    es    Th_m"
' oString = rs2s(1) + " " + rs2s(2)
  Print #1, C.rs3(1), C.rs3(2), C.rs3(3), C.rs3(4)
  Print #1, "  Dependencies of temperature"
  Print #1, " tb     QT"
  Print #1, C.rs3(5), C.rs3(6)
  Print #1, "Denitrification dependencies on water content"
  Print #1, "dThD   Th_d"
  Print #1, C.rs3(7), C.rs3(8)
  Print #1,
Debug.Print C.rs2.GetString
Close #1
C.rs3.Close
C.rs2.Close
C.cn.Close

End Sub
'Writes the climate header file
Dim idStr As String
Dim C As Class1
Dim strSQL As String

Sub WriteClim(idStr As String)

Dim ClimateFile, varietyFile, WeatherID, ClimateID As String

Set C = New Class1
C.Connection
'Description$
strSQL = "SELECT ClimateFile, path, climateID FROM [Description$]  where id=""" + idStr + """"
C.rs.Open strSQL, C.cn

ClimateFile = C.rs(0)
ClimateID = C.rs(2)
FilePath = C.FilePathRoot + "\" + C.rs(1) + "\" + ClimateFile
  Open FilePath For Output As #1
C.rs.Close
' now get the climate data into recordset 0
' only need climate id to filter the records
' CDT - removed location from string (9/17/18)location='" & Location & "' and
strSQL = " select * from [Climate$] where ClimateID='" & ClimateID & "'"
C.rs.Open strSQL, C.cn
' get indicator for daily our hourly data
strSQL = " select ClimateID, time from [Weather$] where ClimateID='" & ClimateID & "'"
C.rs2.Open strSQL, C.cn
 Print #1, "***STANDARD METEOROLOGICAL DATA  Header fle for " & ClimateID
 Print #1, "Latitude Longitude"
 Print #1, C.rs("Latitude"), C.rs("Longitude")
 Print #1, "^Daily Bulb T(1) ^ Daily Wind(2) ^RainIntensity(3) ^Daily Conc^(4) ,Furrow(5) ^Rel_humid(6) ^CO2(7)"
 Print #1, C.rs("DailyBulb"), C.rs("DailyWind"), C.rs("RainIntensity"), C.rs("DailyConc"), C.rs("Furrow"), C.rs("RelHumid"), C.rs("DailyCO2")
 Print #1, "Parameters for changing of units: BSOLAR BTEMP ATEMP ERAIN BWIND BIR "
 Print #1, " BSOLAR is 1e6/3600 to go from j m-2 h-1 to wm-2"
 Print #1, C.rs("Bsolar"), C.rs("Btemp"), C.rs("Atemp"), C.rs("Erain"), C.rs("BWind"), C.rs("BIR")
 ' print headers and labels for avg data
 ' if the labels are written we have to make sure a blank line is added after
 Print #1, "Average values for the site"
  PrintLine = 0
 If C.rs("DailyWind") = 0 Then
   Print #1, "wind    ";
   PrintLine = 1
   End If
 If C.rs("RainIntensity") = 0 And C.rs2("time") = "daily" Then
   Print #1, "irav    ";
   PrintLine = 1
  End If
 If C.rs("DailyConc") = 0 Then
   Print #1, "ChemConc   ";
   PrintLine = 1
  End If
 If C.rs("DailyCO2") = 0 Then
   Print #1, "  CO2  ";
   PrintLine = 1
 End If
 
' need a carriage return if the lables of any of these variables in the following lines are printed out
 If PrintLine = 1 Then Print #1,
 
 ' if no average values then just print line
 If (C.rs("DailyWind") = 1 Or (C.rs("RainIntensity") = 1 And C.rs2("time") = "daily") Or C.rs("DailyConc") = 1 _
        Or C.rs("DailyCO2") = 1) Then Print #1,
 
 If C.rs("DailyWind") = 0 Then Print #1, Spc(1), C.rs("AvgWind"),
 If (C.rs("RainIntensity") = 0 And C.rs2("time") = "daily") Then Print #1, Spc(1), C.rs("AvgRainRate"),
 If C.rs("DailyConc") = 0 Then Print #1, Spc(1), C.rs("ChemConc"),
 If C.rs("DailyCO2") = 0 Then Print #1, Spc(1), C.rs("AvgCO2"),
    Print #1,
 
   C.rs.Close
   C.rs2.Close
  C.cn.Close
  Close #1
End Sub
' Make drip irrigation file
Dim idStr As String
Dim C As Class1
Dim strSQL As String

Sub WriteDrip(idStr As String)
' get id into string
Dim SoilFile As Variant
Dim DripCount, MaxNode, maxNum As Integer
Dim XNodes(200) As Integer
Dim StartTime, StopTime As Double
Dim DripWidth As Double
Dim Date1 As String
Set C = New Class1
C.Connection


'get file name and open file for output
strSQL = "select SoilFile, path from [Description$] where ID ='" & idStr & "'"
C.rs.Open strSQL, C.cn
FilePath = C.FilePathRoot + "\" + C.rs(1) + "\" + idStr + ".drp"
  Open FilePath For Output As #1
SoilFile = C.rs(0)
C.rs.Close
' now get fertilization data

strSQL = "select ID, date, [rate(cm/hr)] as rate , StartTime, StopTime, Distance from [Drip$] where ID='" & idStr & "'"
C.rs.Open strSQL, C.cn, adOpenStatic
' rs now contains fertilization info
'now get count of fert times
DripCount = C.rs.RecordCount
If DripCount > 1 Then


   ' get horizontal coordinates where drip extends to
   strSQL = "Select * from [DripNodes$] where ID='" & idStr & "'"
   C.rs2.Open strSQL, C.cn, adOpenStatic
   NumObs = C.rs2.RecordCount
   ' find the number of nodes less than or equal to the drip width (Distance)

   C.rs2.MoveFirst
   MaxNode = 0
   For i = 0 To NumObs - 1
        XNodes(i + 1) = C.rs2("nodes")
        MaxNode = i + 1
     C.rs2.MoveNext
   Next i
   C.rs2.MoveFirst
 
 
    ' now  start writing file
   Print #1, "*****Script for Drip application module  ******* mAppl is cm water per hour to a 45 x 30 cm area"
   Print #1, "Number of Drip irrigations(max=25)  "
   Print #1, DripCount
   Print #1, "tAppl_start(i) time tAppl_stop(i) time  mAppl(i),  NumNodes(i)  (repeat these 3 lines for the number of drip applications)"
   C.rs.MoveFirst
   maxNum = 15 'maximum number of nodes per line
   For i = 1 To DripCount
     'Drip data are in the rs record set
      Date1 = Format(C.rs("date"), "mm/dd/yyyy")
      StartTime = Int(C.rs("StartTime") * 24) + Minute(C.rs("StartTime")) / 60
      StopTime = Int(C.rs("StopTime") * 24) + Minute(C.rs("StopTime")) / 60
      Print #1, "'" & Date1 & "'", StartTime, "'" & Date1 & "'", StopTime, C.rs("rate"), MaxNode
      'write out nodes for application
      Print #1, "Nodes for the Application " & i
      For j = 1 To MaxNode
         Print #1, XNodes(j);
         If j > maxNum Then
           Print #1,
           maxNum = maxNum + 15
         End If
      
      Next j
      If XNodes(j - 1) > 0 Then Print #1, 'case for less than 15 nodes on the line
      C.rs.MoveNext   'get next application
   Next i
    Print #1,
    C.rs2.Close
Else
   Print #1, "*****Script for Drip application module  ******* mAppl is cm water per hour to a 45 x 30 cm area"
   Print #1, "Number of Drip irrigations(max=25)  "
   Print #1, DripCount
   Print #1, "No drip irrigation"
End If
C.cn.Close
Close #1


End Sub


'Writes Gas parameter file


Sub WriteGas(idStr As String)
Set C = New Class1
C.Connection



' get table of management data for ID

 strSQL = " select [Gas_CO2], [Gas_O2], [Gas_File], path from [Description$] where id ='" & idStr & "'"
 C.rs.Open strSQL, C.cn
 CO2ID = C.rs("Gas_CO2")
 O2ID = C.rs("Gas_O2")
 FilePath = C.FilePathRoot + "\" + C.rs("path") + "\" + C.rs("Gas_File") + ".gas"
  Open FilePath For Output As #1
 '  get soil data for the ID to get layer info

 C.rs.Close
 ' get CO2 params
 strSQL = " Select ID, EPSI, bTort, [Diffusion_Coeff(cm2/day)] from [Gas$] where ID='" & _
    CO2ID & "'"
C.rs.Open strSQL, C.cn, adOpenStatic

' Get O2 params
strSQL = " Select ID, EPSI, bTort, [Diffusion_Coeff(cm2/day)] from [Gas$] where ID='" & _
    O2ID & "'"
C.rs2.Open strSQL, C.cn, adOpenStatic


' write out initial data
 
      Print #1, "*** Gas Movement Parameters Information ***"
      Print #1, " Number of gases"
      Print #1, " 2"
      Print #1, " Computational parameters "
      Print #1, " EPSI"
      Print #1, C.rs("EPSI")
      Print #1, " Reduced tortousity rate change with water content (bTort)"
      Print #1, " for entire soil domain "
      Print #1, C.rs("bTort")
      Print #1, "Gas diffusion coefficients in air at standard conditions, cm2/day"
      Print #1, "Gas # 1 (CO2) Gas # 2 (Oxygen) Gas # 3 (Methane)"
      Print #1, C.rs("Diffusion_Coeff(cm2/day)"), C.rs2("Diffusion_Coeff(cm2/day)")
     
    
   
Close #1
C.rs.Close
C.cn.Close




End Sub


'Writes the initialization file
' now row spacing is an input, don't have to calculate from grid
Dim idStr As String
Dim C As Class1
Dim strSQL As String

Sub WriteIni(idStr As String)
Dim depth, MaxDepth, RowSP As Double
Dim Date1, Date2  As String
Set C = New Class1
C.Connection

 strSQL = "select soilfile, path from [Description$] where id=""" + idStr + """"
 C.rs.Open strSQL, C.cn
 strSoilFile = C.rs(0)
 stPath = C.rs(1)
 FilePath = C.FilePathRoot + "\" + stPath + "\" + idStr + ".ini"
 Open FilePath For Output As #1
 C.rs.Close
 ' now get data from initials table
 strSQL = "select * from [Init$] where id=""" + idStr + """"
 C.rs.Open strSQL, C.cn, adOpenStatic
 ' now rs contains rows of init table - save until writing  file
 
 ' now get soil information to determine planting depth
 ' get max depth of soil
   strSQL = "select [soilFile], max([bottom depth]) as soilDepth from [Soil$] where [soilFile] = '" & _
     strSoilFile & "' group by [soilFile]"
C.rs2.Open strSQL, C.cn, adOpenStatic
depth = C.rs2("soilDepth") - C.rs("seedDepth")
C.rs2.Close

 
RowSP = C.rs("RowSpacing(cm)")
density = C.rs("population(p/ha)") / 10000
PopRow = RowSP / 100 * density
Print #1, "***INitialization data for " & idStr & " location"
Print #1, "POPROW  ROWSP  Plant Density      ROWANG  xSeed  ySeed         CEC    EOMult"
Print #1, PopRow, RowSP, density, C.rs("rowangle"), C.rs("xseed"), depth, C.rs("cec"), C.rs("eomult")
Print #1, "Latitude longitude altitude"
Print #1, C.rs("lat"), C.rs("long"), C.rs("altitude(m)")
Print #1, "AutoIrrigate"
Print #1, C.rs("autoIrrigated")
Print #1, "  Sowing        end         timestep"
Date1 = Format(C.rs("sowing"), "mm/dd/yyyy")
Date2 = Format(C.rs("end"), "mm/dd/yyyy")
Print #1, "'" & Date1 & "'", "'" & Date2 & "'", "60"
Print #1, "output soils data (g03, g04, g05 and g06 files) 1 if true"
Print #1, "                          no soil files        output soil files"
Print #1, "    0                     1           "




 
 

 C.rs.Close

 C.cn.Close
 Close #1
 
 End Sub
'writes layer file that is sent to the create soils program
' now inputs rowspacing and does not use xGrid
Sub WriteLayer(idStr As String)
Dim path, FilePath, SoilFile, SoilName, strSQL, loc2, DriveLoc As String
Dim NumObs As Integer
Set C = New Class1
C.Connection
' C.rs contains GridRatio sheet
' C.rs2 has Row spacing from initials

'get file name and open file for output
strSQL = "select SoilFile, path, SoilName from [Description$] where ID ='" & idStr & "'"
C.rs.Open strSQL, C.cn


path = C.rs(1)
FilePath = C.FilePathRoot + "\" + path + "\" + idStr + ".lyr"
  Open FilePath For Output As #1
SoilFile = C.rs("SoilFile")
SoilName = C.rs("SoilName")
C.rs.Close

' get GridRatio data
 strSQL = "Select * from [GridRatio$] where SoilFile='" + SoilFile + "'"
C.rs.Open strSQL, C.cn, adOpenStatic
' Print #1, "Put NoSoil or Soil here to have the program generate soils data"
'    Print #1, "Soil"
 '    Print #1, "If you want to generate a new grid put a file name after the Grid Gen:"
'    Print #1, "Grid Gen: dataGen2.dat"
    Print #1, "surface ratio    internal ratio: ratio of the distance between two neighboring nodes"
     Print #1, C.rs("SR1"), C.rs("IR1"), C.rs("SR2"), C.rs("IR2")
   
strSQL = "Select [RowSpacing(cm)] from [Init$] where ID ='" & idStr & "'"
C.rs2.Open strSQL, C.cn, adOpenStatic

Print #1, "Row Spacing"
Print #1, C.rs2("RowSpacing(cm)")

C.rs2.Close

'add root generation and layer information

     Print #1, " Planting Depth  X limit for roots "
     Print #1, C.rs("PlantingDepth"), C.rs("XLimitRoot"), C.rs("InitRtMass") 'experimental now - for potato
     Print #1, "Surface water Boundary Code  surface and bottom Gas boundary codes"
     Print #1, "for the  (water boundary code for bottom layer (for all bottom nodes) 1 constant -2 seepage face,  7 drainage"
     Print #1, C.rs("BottomBC"), C.rs("GasBCTop"), C.rs("GasBCBottom")
     Print #1, " Bottom depth Init Type  OM (%/100)   no3(ppm)       NH4         hNew       Tmpr   " & _
     "  CO2     O2    Sand     Silt    Clay     BD     TH33     TH1500  " & _
       "thr ths tha th  Alfa    n   Ks  Kk  thk"
     Print #1, " cm         w/m              Frac      ppm          ppm           cm         0C   " & _
           "  ppm   ppm  ----  fraction---     g/cm3    cm3/cm3   cm3/cm3"
      C.rs.Close
     
'Now add soil properties (C.rs)
strSQL = "Select * from [Soil$] where [soilFile]='" + SoilFile + "'"
C.rs.Open strSQL, C.cn, adOpenStatic
Do Until C.rs.EOF
 Print #1, C.rs("bottom depth"), "'" & C.rs("Init Type") & "'", C.rs("OM (%/100)"), C.rs("NO3 (ppm)"), C.rs("NH4"), C.rs("HNew"), _
       C.rs("tmpr"), C.rs("CO2(ppm)"), C.rs("O2(ppm)"), C.rs("Sand") / 100, C.rs("Silt") / 100, C.rs("clay") / 100, C.rs("BD"), C.rs("TH33"), C.rs("TH1500"), _
        C.rs("thr"), C.rs("ths"), C.rs("tha"), C.rs("th"), C.rs("Alfa"), C.rs("n"), C.rs("Ks"), C.rs("Kk"), C.rs("thk")
',
C.rs.MoveNext
Loop
C.rs.Close
Close #1

Dim fso As FileSystemObject
Dim loc, newPath As Variant
Dim runName As String
Dim result As Integer
loc = CurDir()  'save location of current directory
newPath = C.FilePathRoot + "\" + path
DriveLoc = Left(newPath, InStr(newPath, ":") - 1)
ChDrive DriveLoc
ChDir newPath
loc2 = CurDir()

' check if soil file as .soi or another extension
result = InStr(SoilFile, ".soi")
If (result > 0) Then
  SoilFile2 = Replace(SoilFile, ".soi", "")
End If



Open "grid1.bat" For Output As #1
runName = C.CreateSoilsPath + "\CreateSoilFiles_CO2.exe """ + FilePath + """ /GN " + idStr + " /SN " + SoilFile2
Print #1, runName
Print #1, "del output"
 Print #1, "del element_elm"
  Print #1, "del grid_bnd"
  Print #1, "del datagen2.dat"
  oldsoil = idStr + ".soi"
  Print #1, "Dir  *.*  >dir.txt"
  
Close #1
Open "grid2.bat" For Output As #1
Print #1, "Dir *.* > dir2.txt"
Close #1
' now run batch file
'Shell ("grid1.bat")
'Shell ("grid2.bat")


'change back to root path
ChDir loc


'Now call program to do calculations
End Sub


' Make management file
' April, 2020 removed nodes for chem application
' now use the depth and 2DSOIL finds the nodes
Dim idStr As String
Dim C As Class1
Dim strSQL As String

Sub WriteMan(idStr As String)
' get id into string
Dim SoilFile, Tillage As Variant
Dim fertCount As Integer
Dim amount, depth As Double
Dim MaxX, sC, sN, factor As Double
Dim Date1 As String
Dim SowDate, startDate As Date
Set C = New Class1
C.Connection


'get file name and open file for output
strSQL = "select SoilFile, Tillage, path from [Description$] where ID ='" & idStr & "'"
C.rs.Open strSQL, C.cn
FilePath = C.FilePathRoot + "\" + C.rs("Path") + "\" + idStr + ".man"
  Open FilePath For Output As #1
SoilFile = C.rs("SoilFile")
Tillage = C.rs("Tillage")
C.rs.Close

' get rowspacing to calculate width of grid
strSQL = "select [RowSpacing(cm)], sowing from [Init$] where ID ='" & idStr & "'"
C.rs.Open strSQL, C.cn
MaxX = C.rs("RowSpacing(cm)") / 2
SowDate = C.rs("sowing")
C.rs.Close

' get start date
strSQL = "select startDate from [Time$] where ID ='" & idStr & "'"
C.rs.Open strSQL, C.cn
startDate = C.rs(0)
C.rs.Close

' now get fertilization data if any

strSQL = "select ID, [amount] , depth, [Litter_C(kg/ha)], Litter_N, Manure_C, Manure_N, date from [Fertilization$] where ID='" & idStr & "'"
C.rs.Open strSQL, C.cn, adOpenStatic
' rs now contains fertilization info
'now get count of fert times
fertCount = C.rs.RecordCount
If fertCount > 0 Then

 ' now  start writing fertilization info into the file
   Print #1, "*** Script for management practices fertilizer, residue and tillage"
   Print #1, "[N Fertilizer]"
   Print #1, "****Script for chemical application module  *******mg/cm2= kg/ha* 0.01*rwsp*eomult*100"
   Print #1, "Number of Fertilizer applications (max=25) mappl is in total mg N applied to grid " & _
           "(1 kg/ha = 1 mg/m2/width of application) application divided by width of grid in cm is kg ha-1"
   Print #1, fertCount
   Print #1, "mAppl is manure, lAppl is litter. Apply as mg/cm2 of slab same units as N"
   Print #1, "tAppl(i)  AmtAppl(i) depth(i) lAppl_C(i) lAppl_N(i)  mAppl_C(i) mAppl_N(i)  (repeat these 3 lines for the number of fertilizer applications)"
   C.rs.MoveFirst
   For i = 1 To fertCount
    'fert data are in the rs record set
     factor = 0.01 * MaxX / 100 'm2 of slab
     ' area of slab m2/slab x kg/ha x 1 ha/10000 m2 *1e6 mg/kg = mg/slab
     amount = C.rs(1) * factor / 10000 * 1000000#
     depth = C.rs("depth")
     L_C = C.rs("Litter_C(kg/ha)") * factor / 10000 * 1000000#   'litter
     L_N = C.rs("Litter_N") * factor / 10000 * 1000000#
     M_C = C.rs("Manure_C") * factor / 10000 * 1000000#   'manure
     M_N = C.rs("Manure_N") * factor / 10000 * 1000000#
     Date1 = Format(C.rs("Date"), "mm/dd/yyyy")
     Print #1, "'" & Date1 & "'", amount, depth, L_C, L_N, M_C, M_N
     C.rs.MoveNext
   Next i

Else
   Print #1, "****Script for chemical application module  *******mg/cm2= kg/ha* 0.01*rwsp*eomult*100"
   Print #1, "Number of Fertilizer applications (max=25) mappl is in total mg N applied to grid "
   Print #1, "(1 kg/ha = 1 mg/m2/width of application) application divided by "
   Print #1, "width of grid in cm is kg ha-1"
   Print #1, fertCount
   Print #1, "No fertilization"
End If
C.rs.Close
'now write mulch information.
strSQL = "select ID, [date_residue] , [type(t or m)], [rate (t/ha or  cm)], [vertical layers] from  [Fertilization$] where ID='" & idStr & "'"
C.rs.Open strSQL, C.cn, adOpenStatic
    Print #1, "[Residue]"
    Print #1, "****Script for residue/mulch application module"
    Print #1, "**** Residue amount can be thickness ('t') or mass ('m')   ***"
    Print #1, "application  1 or 0, 1(yes) 0(no)"
 If (C.rs("date_residue") <> "") Or C.rs("rate (t/ha or  cm)") <> 0 Then
    Print #1, "1"
    Print #1, "tAppl_R (i)    't' or 'm'      Mass (gr/m2) or thickness (cm)    vertical layers"
    Print #1, "---either thickness  or Mass"
    Date2 = Format(C.rs("date_residue"), "mm/dd/yyyy")
    Print #1, "'" & Date2 & "'", "'" & C.rs("type(t or m)") & "'", C.rs("rate (t/ha or  cm)"), C.rs("vertical layers")
    Print #1,
Else
    Print #1, "0"
End If
C.rs.Close
' now for tillage
    Print #1, "[Tillage]"
    Print #1, "1: Tillage , 0: No till"
    strSQL = "Select ID, [Till(1/0)], [DaysBeforePlanting], Depth from [Tillage$] where ID= '" & Tillage & "'"
    C.rs.Open strSQL, C.cn, adOpenStatic
    Print #1, C.rs("Till(1/0)")
    If C.rs("Till(1/0)") = 1 Then
       tillDate = SowDate - C.rs("DaysBeforePlanting")
       If tillDate <= startDate Then
         response = MsgBox("tillage too close to start date, please rechoose", vbOKOnly)
         End If
       Print #1, "till_Date   till_Depth"
       Print #1, "'" & tillDate & "'", C.rs("Depth")
    End If

     
C.cn.Close
Close #1
End Sub
' Make mulch file
' May, 2021 first version
Dim idStr As String
Dim idStrMulch As String
Dim C As Class1
Dim strSQL As String
'this program writes all the mulch parameters to the same file
' but uses as input the MulchGeo and MulchDecomp worksheets
Sub WriteMulch(idStr As String)
' get id into string
Set C = New Class1
C.Connection

'get file name and open file for output
strSQL = "select MulchGeo, MulchDecomp, path from [Description$] where ID ='" & idStr & "'"
C.rs.Open strSQL, C.cn
idStrMulchDecomp = C.rs("MulchDecomp")
idStrMulchGeo = C.rs("MulchGeo")
FilePath = C.FilePathRoot + "\" + C.rs("path") + "\" + idStrMulchGeo + ".mul"
  Open FilePath For Output As #1
C.rs.Close


strSQL = "Select * from [MulchGeo$] where id ='" & idStrMulchGeo & "'"
C.rs.Open strSQL, C.cn
Print #1, "*** Mulch Material information ****  based on g, m^3, J and oC"
Print #1, "[Basic_Mulch_Configuration]"
Print #1, "********The mulch grid configuration********"
Print #1, "Minimal Grid Size for Horizontal Element"
Print #1, C.rs("Min_Hori_Size")
Print #1, "********Simulation Specifications (1=Yes; 0=No)********"
Print #1, "Only_Diffusive_Flux     Neglect_LongWave_Radiation      Include_Mulch_Decomputions"
Print #1, C.rs("Diffusion_Restriction"), C.rs("LongWaveRadiationCtrl"), C.rs("Decomposition_ctrl")
Print #1, "[Mulch_Radiation]"
Print #1, "********Mulch Radiation Properties********"
Print #1, "DeltaRshort DeltaRlong  Omega   epsilon_mulch   alpha_mulch"
Print #1, C.rs("DeltaRshort"), C.rs("DeltaRlong"), C.rs("Omega"), C.rs("epsilon_mulch"), C.rs("alpha_mulch")
Print #1, "[Numerical_Controls]"
Print #1, "********Picard Iteration COntrol********"
Print #1, "Max Iteration Step (before time step shrinkage) Tolerence for Convergence (%)"
Print #1, C.rs("MaxStep in Picard Iteration"), C.rs("Tolerance_head")
Print #1, "[Mulch_Mass_Properties]"
Print #1, "********Some Basic Information such as density, porosity and empirical parameters********"
Print #1, "VRho_Mulch g/m3  Pore_Space  Max Held Ponding Depth"
Print #1, C.rs("rho_mulch"), C.rs("pore_space"), C.rs("MaxPondingDepth")

C.rs.Close
'now do mulch decomp information
strSQL = "Select * from [MulchDecomp$] where id ='" & idStrMulchDecomp & "'"
C.rs.Open strSQL, C.cn
Print #1, "[Mulch_Decomposition]"
Print #1, "********Overall Factors********"
Print #1, "Contacting_Fraction Feeding_Coef"
Print #1, C.rs("ContactFraction"), C.rs("alpha_feeding")
Print #1, "The Fraction of Three Carbon Formats (Initial Value)"
Print #1, " Carbonhydrate(CARB)    Holo-Cellulose (CEL)   Lignin (LIG)"
Print #1, C.rs("CARB MASS"), C.rs("CELL MASS"), C.rs("LIGN MASS")
Print #1, "The Fraction of N in Three Carbon Formats (Initial Value)"
Print #1, " Carbonhydrate(CARB)    Holo-Cellulose (CEL)   Lignin (LIG)"
Print #1, C.rs("CARB N MASS"), C.rs("CELL N MASS"), C.rs("LIGN N MASS")
Print #1, "The Intrinsic Decomposition Speed of Three Carbon Formats (day^-1)"
Print #1, " Carbonhydrate(CARB)    Holo-Cellulose (CEL)   Lignin (LIG)"
Print #1, C.rs("CARB Decomp"), C.rs("CELL Decomp"), C.rs("LIGN Decomp")

C.rs.Close
C.cn.Close
Close #1
End Sub

'Writes the Nitrogen file
Dim idStr As String
Dim C As Class1
Dim strSQL As String

Sub WriteNit(idStr As String)
Dim SoilFile As Variant
Dim C As Class1
Dim NitrogenFile As String
Dim NCount As Integer
Dim MaxX As Double

Set C = New Class1
C.Connection

strSQL = "SELECT SoilFile, NitrogenFile, path FROM [Description$]where id=""" + idStr + """"
C.rs.Open strSQL, C.cn
NitrogenFile = C.rs(1)
SoilFile = C.rs(0)

FilePath = C.FilePathRoot + "\" + C.rs(2) + "\" + NitrogenFile
  Open FilePath For Output As #1
C.rs.Close

' now get the Nitrogen data into recordset 0
strSQL = " select kh, kl, km, kn, kd, fe, fh, r0, rl, rm, fa, nq, cs from [Soil$] where [soilFile]='" & SoilFile & "'"
C.rs.Open strSQL, C.cn, adOpenStatic
NCount = C.rs.RecordCount

' now need some information on the maximum width of grid to get row spacing
strSQL = "Select [rowSpacing(cm)] from [Init$] where id=""" + idStr + """"
C.rs2.Open strSQL, C.cn, adOpenStatic
 'find max width
 MaxX = C.rs2("rowSpacing(cm)") / 2 / 100 * 2#
 
 Print #1, " *** SoilNit parameters for: " & idStr & "***"
      Print #1, "ROW SPACING (m)"
      Print #1, MaxX
      Print #1, "                             Potential rate constants:       Ratios and fractions:"
      Print #1, "  m      kh     kL       km       kn        kd             fe   fh    r0   rL    rm   fa    nq   cs"
     
    i = 1
    Do Until C.rs.EOF
             Print #1, i, C.rs(0), C.rs(1), C.rs(2), C.rs(3), C.rs(4), C.rs(5), C.rs(6), C.rs(7), C.rs(8), C.rs(9), _
            C.rs(10), C.rs(11), C.rs(12)
       C.rs.MoveNext
       i = i + 1
    Loop
    Print #1,
    
   
   
   C.rs.Close
   C.rs2.Close
  C.cn.Close
  Close #1
End Sub

' writes the runfile

Sub WriteRun(idStr As String)
Dim BasePath As String
Dim C As Class1
Dim strSQL As String
Dim path As String
Dim NCount As Integer
Dim MaxX As Double

Set C = New Class1
C.Connection

strSQL = "SELECT path FROM [Description$] where id='" + idStr + "'"
C.rs.Open strSQL, C.cn
path = C.rs("path")

FilePath = C.FilePathRoot + "\" + path + "\run" + idStr + ".dat"
  Open FilePath For Output As #1
C.rs.Close
BasePath = C.FilePathRoot + "\" + path

strSQL = "Select ID, [WeatherFileName], Biology, ClimateFile, NitrogenFile, Solute, SoilFile, " & _
         "MulchGeo, Gas_File, varietyFile from [Description$] " & _
            "where ID ='" + idStr + "'"
            
C.rs.Open strSQL, C.cn

Print #1, BasePath + "\" + C.rs("WeatherFileName")
Print #1, BasePath + "\" + idStr + ".tim"
Print #1, BasePath + "\" + C.rs("Biology") + ".bio"
Print #1, BasePath + "\" + C.rs("ClimateFile")
Print #1, BasePath + "\" + C.rs("NitrogenFile")
Print #1, BasePath + "\" + C.rs("Solute") + ".sol"
Print #1, BasePath + "\" + C.rs("Gas_File"); ".gas"
Print #1, BasePath + "\" + C.rs("SoilFile")
Print #1, BasePath + "\" + C.rs("MulchGeo") + ".mul"
Print #1, BasePath + "\" + idStr + ".man"
Print #1, BasePath + "\" + idStr + ".drp"
Print #1, C.FilePathRoot + "\Water.DAT"
Print #1, C.FilePathRoot + "\WaterBound.DAT"
Print #1, BasePath + "\" + idStr + ".ini"
Print #1, BasePath + "\" + C.rs("varietyFile")
Print #1, BasePath + "\" + idStr + ".grd"
Print #1, BasePath + "\" + idStr + ".nod"
Print #1, BasePath + "\MassBl.dat"
Print #1, BasePath + "\" + idStr + ".g01"
Print #1, BasePath + "\" + idStr + ".g02"
Print #1, BasePath + "\" + idStr + ".G03"
Print #1, BasePath + "\" + idStr + ".G04"
Print #1, BasePath + "\" + idStr + ".G05"
Print #1, BasePath + "\" + idStr + ".G06"
Print #1, BasePath + "\MassBl.out"
Print #1, BasePath + "\MassBlRunOff.out"
Print #1, BasePath + "\MassBlMulch.out"

  C.rs.Close
  C.cn.Close
  Close #1




End Sub
'Writes solute file
Public Declare PtrSafe Sub what_texture Lib "D:\MAIZSIM07\ExcelInterface\TextureClass(32).dll" _
 (ByVal arg1 As Single, ByVal arg2 As Single, ByVal arg3 As String)
Dim C As Class1
Dim strSQL As String

Sub WriteSol(idStr As String)
Set C = New Class1
C.Connection

Dim texture As String * 22
Dim slashes() As String
Dim TextureCl(20) As String

' get table of management data for ID

 strSQL = " select soilFile,solute, path from [Description$] where id ='" & idStr & "'"
 C.rs.Open strSQL, C.cn
 SolFile = C.rs(1)
 SoilFile = C.rs(0)
 FilePath = C.FilePathRoot + "\" + C.rs(2) + "\" + SolFile + ".sol"
  Open FilePath For Output As #1
 '  get soil data for the ID to get layer info

 C.rs.Close
 strSQL = " Select sand, silt, clay from [Soil$] where [soilFile]='" & _
    SoilFile & "'"
C.rs.Open strSQL, C.cn, adOpenStatic
LayCount = C.rs.RecordCount

' now we have the soil data in C.rs. put the solute data in C.rs2
 strSQL = "Select * from [Solute$] where id ='" & SolFile & "'"
C.rs2.Open strSQL, C.cn, adOpenStatic

' now iterate over soil data in C.rs and add texture to an array
For i = 0 To C.rs.RecordCount - 1
   
   ' Call what_texture(C.rs(0), C.rs(2), texture)
   texture = "/loam /clay  /silt"
   slashes = Split(texture, "/")
   Max = UBound(slashes)
    'Assumes we won't have more than two textures, but choose the second one in that case
   If Max = 1 Then
      TextureCl(i) = slashes(1)
   End If
 
   If Max > 1 Then
     TextureCl(i) = slashes(Max - 1)
     End If
    C.rs.MoveNext
Next i
'get dispersivity texture pairs
C.Conn_Dispersiv

' write out initial data
 
      Print #1, "*** SOLUTE MOVER PARAMETER INFORMATION ***"
      Print #1, " Number of solutes"
      Print #1, " 1"
      Print #1, " Computational parameters "
      Print #1, " EPSI        lUpW             CourMax"
      Print #1, C.rs2(1), C.rs2(2), C.rs2(3)
      Print #1, " Material Information"
      Print #1, "Solute#, Ionic/molecular diffusion coefficients of solutes "
      Print #1, "  1    "; C.rs2(4)
      Print #1, "  Solute#, Layer#, Longitudinal Dispersivity, Transversal Dispersivity (units are cm)"
'have to do the lookup manually to find dispersivity associated with a particular soil texture
     

' loop through soil table first
C.rs.MoveFirst
 For i = 0 To C.rs.RecordCount - 1
      strSQL = "Select * from [Dispersivity$] where texturecl= '" & TextureCl(i) & "'"
      C.rs_D.Open strSQL, C.cn_D
      Print #1, "1     ", i + 1, C.rs_D(1), C.rs_D(1) / 2#
      C.rs_D.Close
      
      
    Next i
    Print #1,
     
   
Close #1
C.rs.Close
C.cn.Close
C.cn_D.Close



End Sub
' Write time file
Dim idStr As String
Dim C As Class1
Dim strSQL As String

Sub WriteTime(idStr As String)

' C is the database connection object
Set C = New Class1
C.Connection
Dim Date1, Date2 As String


' get time data from file
strSQL = " select soilFile, path from [Description$] where id ='" & idStr & "'"
 C.rs.Open strSQL, C.cn
 SoilFile = C.rs(0)
 FilePath = C.FilePathRoot + "\" + C.rs(1) + "\" + idStr + ".tim"
 Open FilePath For Output As #1
 C.rs.Close

 ' get necessary time values
strSQL = "Select * from [Time$] where id ='" & idStr & "'"
  C.rs.Open strSQL, C.cn
  Print #1, "*** SYNCHRONIZER INFORMATION *****************************"
  Date1 = Format(C.rs(1), "mm/dd/yyyy")
  Date2 = Format(C.rs(2), "mm/dd/yyyy")
  Print #1, "Initial time       dt       dtMin     DMul1    DMul2    tFin"
  Print #1, "'" & Date1 & "'", C.rs(3), C.rs(4), C.rs(5), C.rs(6), "'" & Date2 & "'"
  Print #1, "Output variables, 1 if true  Daily    Hourly"
  Print #1, C.rs(7), C.rs(8)
  Print #1, " Daily       Hourly   Weather data frequency. if daily enter 1   0; if hourly enter 0  1  "
  Print #1, C.rs(9), C.rs(10)
  Print #1, "RunToEnd  - if 1 model continues after crop maturity to end time in time file"
  Print #1, C.rs("RunToEnd")

  C.rs.Close
  C.cn.Close
  Close #1
  
  
 
End Sub
' write variety file
Dim idStr As String
Dim C As Class1
Dim strSQL As String

Sub WriteVar(idStr As String)

Dim Hybrid, varietyFile As String

Set C = New Class1
C.Connection

strSQL = "SELECT Hybrid, VarietyFile, path FROM [Description$]  where id=""" + idStr + """"
C.rs.Open strSQL, C.cn
Hybrid = C.rs(0)
varietyFile = C.rs(1)
FilePath = C.FilePathRoot + "\" + C.rs(2) + "\" + C.rs(1) ' C.rs(2) + "\" + Hybrid + ".var" <- use this later
  Open FilePath For Output As #1
C.rs.Close

' get hybrid data into recordset
strSQL = "select * from [variety$] where hybrid='" & Hybrid & "'"
C.rs.Open strSQL, C.cn

Print #1, "Corn growth simulation for  "; Hybrid; "   variety "
Print #1, " Juvenile   Daylength   StayGreen  LA_min  Rmax_LTAR              Rmax_LTIR                Phyllochrons from "
Print #1, " leaves     Sensitive               Leaf tip appearance   Leaf tip initiation       TassellInit"
Print #1, C.rs("JuvenileLeaves"), C.rs("DayLengthSensitive"), C.rs("StayGreen"), _
             C.rs("LM_min"), C.rs("RMax_LTAR"), C.rs("RMax_LTIR"), C.rs("PhyllFrmTassel")
Print #1, "[SoilRoot]"
Print #1, "*** WATER UPTAKE PARAMETER INFORMATION **************************"
Print #1, " RRRM       RRRY    RVRL"
Print #1, C.rs("RRRM"), C.rs("RRRY"), C.rs("RVRL")
Print #1, " ALPM    ALPY     RTWL    RtMinWtPerUnitArea"
Print #1, C.rs("ALPM"), C.rs("ALPY"), C.rs("RTWL"), C.rs("RTMinWTperArea")
Print #1, "[RootDiff]"
Print #1, " *** ROOT MOVER PARAMETER INFORMATION ***"
Print #1, "EPSI        lUpW             CourMax"
Print #1, C.rs("EPSI"), C.rs("lUpW"), C.rs("CourMax")
Print #1, "Diffusivity and geotropic velocity"
Print #1, C.rs("Diffx"), C.rs("Diffz"), C.rs("Velz")
Print #1, "[SoilNitrogen]"
Print #1, "*** NITROGEN ROOT UPTAKE PARAMETER INFORMATION **************************"
Print #1, "ISINK    Rroot         "
Print #1, C.rs("ISink"), C.rs("Rroot")
Print #1, "ConstI   Constk     Cmin0 "
Print #1, C.rs("ConstI_M"), C.rs("ConstK_M"), C.rs("Cmin0_M")
Print #1, C.rs("ConstI_Y"), C.rs("ConstK_Y"), C.rs("Cmin0_Y")
' will incorporate these into the database soon
Print #1, "[Gas_Exchange Species Parameters] "
Print #1, "**** for photosynthesis calculations ***"
Print #1, "EaVp    EaVc    Eaj     Hj      Sj     Vpm25   Vcm25    Jm25    Rd25    Ear       g0    g1"
Print #1, "75100   55900   32800   220000  702.6   70      50       325    2       39800   0.017   4.53"
Print #1, "*** Second set of parameters for Photosynthesis ****"
Print #1, "f (spec_correct)     scatt  Kc25    Ko25    Kp25    gbs         gi      gamma1"
Print #1, "0.15                 0.15   650      450    80      0.003       1       0.193"
Print #1, "**** Third set of photosynthesis parameters ****"
Print #1, "Gamma_gsw  sensitivity (sf) Reference_Potential_(phyla, bars) stomaRatio widthFact lfWidth (m)"
Print #1, "  10.0        2.3               -1.2                             1.0        0.72   0.050"
Print #1, "**** Secondary parameters for miscelanious equations ****"
Print #1, "internal_CO2_Ratio   SC_param      BLC_param"
Print #1, "0.7                   1.57           1.36"
Print #1, "***** Q10 parameters for respiration and leaf senescence"
Print #1, "Q10MR            Q10LeafSenescense"
Print #1, "2.0                     2.0"
Print #1, "**** parameters for calculating the rank of the largest leaf and potential length of the leaf based on rank"
Print #1, "leafNumberFactor_a1 leafNumberFactor_b1 leafNumberFactor_a2 leafNumberFactor_b2"
Print #1, "-10.61                   0.25                   -5.99           0.27"
Print #1, "**************Leaf Morphology Factors *************"
Print #1, "LAF        WLRATIO         A_LW"
Print #1, " 1.37          0.106           0.75"
Print #1, "*******************Temperature factors for growth *****************************"
Print #1, "T_base                 T_opt            t_ceil  t_opt_GDD"
Print #1, "8.0                   32.1              43.7       34.0"
Print #1,

  C.rs.Close
  C.cn.Close
  Close #1



End Sub
Dim idStr As String
Dim C As Class1
Dim strSQL As String
Dim Date1 As String
Dim ClimateID, WeatherID As String
Dim WeatherFile, interval As String
Dim FilePath, path As String
Dim DailyWind, RelHumd, DailyCO2 As Integer
Dim RainRate As Double
Function NewCDec(MyVal) As Double
   NewCDec = CDec(MyVal)
End Function


Sub WriteWea(idStr As String)

Set C = New Class1
C.GetMyWeather
C.Connection
'Description$
' first get WeatherID and CLimateID from description
strSQL = "SELECT ClimateID, WeatherID, WeatherFileName, path FROM [Description$]  where id=""" + idStr + """"
C.rs.Open strSQL, C.cn

ClimateID = C.rs("ClimateID")
WeatherID = C.rs("WeatherID")
path = C.rs("path")
FilePath = C.FilePathRoot + "\" + path + "\" + C.rs("WeatherFileName")
C.rs.Close

' now get name of weather file
strSQL = "Select Source_name, time from [Weather$] where ClimateID='" & ClimateID & "'" _
& " and weatherID=" & "'" & WeatherID & "'"
C.rs.Open strSQL, C.cn
WeatherFile = C.rs("source_name")
interval = C.rs("time")
C.rs.Close
' check what data are available
strSQL = " select * from [Climate$] where ClimateID='" & ClimateID & "'"
C.rs.Open strSQL, C.cn
DailyWind = C.rs("DailyWind")
RelHumid = C.rs("RelHumid")
DailyCO2 = C.rs("DailyCO2")
AvgWind = C.rs("AvgWind")
AvgRainRate = C.rs("AvgRainRate")
AvgCO2 = C.rs("AvgCO2")
C.rs.Close

' now get times
strSQL = "Select * from [Time$] where id ='" & idStr & "'"
C.rs.Open strSQL, C.cn
startDate = (C.rs("startDate")) - 2
EndDate = (C.rs("EndDate")) + 4
TimeInterval = startDate And EndDate
C.rs.Close

'----------------------------------
Open FilePath For Output As #1
Print #1, "*** " & idStr & ",  " & interval & " weather data"
x = NewCDec(1)

If interval = "daily" Then
   strSQL = "SELECT jday, date, srad, wind, rh, rain, tmax, tmin, CO2  FROM [" & WeatherFile & "]" & _
      " where climateID='" & ClimateID & "'" & _
      " and weatherID='" & WeatherID & "'" & _
      " and (date >= #" & startDate & "# and date <= #" & EndDate & "#)"

   C.rs_W.Open strSQL, C.cn_W
   
   
Print #1, " JDay   Date       Rad      Temper    rain "
   
   Do Until C.rs_W.EOF
     Date1 = Format(C.rs_W("date"), "mm/dd/yyyy")
     
     Print #1, C.rs_W("jday"), "'" & Date1 & "'", C.rs_W("srad"), C.rs_W("tmax"), C.rs_W("tmin"), _
       C.rs_W("rain"),
       If DailyWind > 0 Then
         Print #1, C.rs_W("wind"),
        End If
        If RelHumid > 0 Then
          Print #1, C.rs_W("rh"),
         End If
        If DailyCO2 > 0 Then
          Print #1, C.rs_W("CO2"),
         End If
        Print #1,
       C.rs_W.MoveNext
    Loop
End If 'daily
'jday, Date, hour, srad, temperature, rain
If interval = "hourly" Then

   strSQL = "SELECT  * FROM [" & WeatherFile & "]" & _
      " where climate_ID='" & ClimateID & "'" & _
      " and weather_ID='" & WeatherID & "'" & _
      " and (date >= #" & startDate & "# and date <= #" & EndDate & "#)"
      
   C.rs_W.Open strSQL, C.cn_W
 Print #1, " JDay   Date  Hour     Rad      Temper    rain     Wind   RH   CO2"
   
 Do Until C.rs_W.EOF
    Date1 = Format(C.rs_W("date"), "mm/dd/yyyy")
     
     Print #1, C.rs_W("jday"), "'" & Date1 & "'", C.rs_W("hour"), C.rs_W("srad"), C.rs_W("temperature"), _
       C.rs_W("rain"),
       If DailyWind > 0 Then
         Print #1, C.rs_W("wind"),
        End If
        If RelHumid > 0 Then
          Print #1, C.rs_W("rh"),
         End If
        If DailyCO2 > 0 Then
          Print #1, C.rs_W("CO2"),
         End If
        Print #1,
       C.rs_W.MoveNext
    Loop
End If 'hourly
'Debug.Print C.rs.GetString
Close #1
C.rs_W.Close

'C.cn.Close

End Sub
